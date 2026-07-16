import type { Readable } from 'node:stream';

import type { ExpressProjectFile } from '@docpilot/parser';
import yauzl from 'yauzl';
import type { Entry, ZipFile } from 'yauzl';

import type { GitHubAnalysisLimits } from './github-config.js';
import { GitHubAnalysisError } from './github-errors.js';

const supportedFileExtension = /\.(?:js|jsx|ts|tsx)$/i;
const declarationFile = /\.d\.(?:ts|tsx)$/i;
const minifiedFile = /\.min\.(?:js|jsx|ts|tsx)$/i;
const excludedDirectories = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  'vendor',
]);

export interface RepositoryArchiveContents {
  files: ExpressProjectFile[];
  filesSkipped: string[];
}

export async function readRepositoryArchive(
  archivePath: string,
  limits: GitHubAnalysisLimits,
): Promise<RepositoryArchiveContents> {
  let zipFile: ZipFile;

  try {
    zipFile = await yauzl.openPromise(archivePath, {
      lazyEntries: true,
      validateEntrySizes: true,
      strictFileNames: true,
    });
  } catch (error) {
    throw invalidArchive(error);
  }

  const files: ExpressProjectFile[] = [];
  const filesSkipped: string[] = [];
  let archiveRoot: string | undefined;
  let entryCount = 0;
  let combinedSourceBytes = 0;

  try {
    while (true) {
      const entry = await readNextEntry(zipFile);

      if (entry === null) {
        break;
      }

      entryCount += 1;

      if (entryCount > limits.maximumArchiveEntries) {
        throw new GitHubAnalysisError(
          'REPOSITORY_TOO_LARGE',
          'The repository archive contains too many entries.',
        );
      }

      const entryPath = validateEntryPath(entry.fileName);
      const root = entryPath.segments[0];

      if (root === undefined) {
        throw invalidArchive();
      }

      if (archiveRoot === undefined) {
        archiveRoot = root;
      } else if (root !== archiveRoot) {
        throw invalidArchive();
      }

      if (entryPath.segments.length === 1) {
        if (!entryPath.isDirectory) {
          throw invalidArchive();
        }

        continue;
      }

      const filePath = entryPath.segments.slice(1).join('/');

      if (entryPath.isDirectory || isDirectoryEntry(entry)) {
        continue;
      }

      const sourceCandidate = supportedFileExtension.test(filePath);

      if (isSymbolicLink(entry)) {
        if (sourceCandidate) {
          filesSkipped.push(filePath);
        }

        continue;
      }

      if (!sourceCandidate) {
        continue;
      }

      if (shouldSkipSourceFile(filePath)) {
        filesSkipped.push(filePath);
        continue;
      }

      if (files.length >= limits.maximumSupportedFiles) {
        throw new GitHubAnalysisError(
          'REPOSITORY_TOO_LARGE',
          'The repository contains more than 100 supported source files.',
        );
      }

      files.push(
        await readSourceEntry(
          zipFile,
          entry,
          filePath,
          limits,
          combinedSourceBytes,
        ),
      );
      combinedSourceBytes += entry.uncompressedSize;

      if (combinedSourceBytes > limits.maximumCombinedSourceBytes) {
        throw new GitHubAnalysisError(
          'REPOSITORY_TOO_LARGE',
          'The repository exceeds the 5 MiB combined source limit.',
        );
      }
    }
  } catch (error) {
    if (error instanceof GitHubAnalysisError) {
      throw error;
    }

    throw invalidArchive(error);
  } finally {
    zipFile.close();
  }

  return {
    files,
    filesSkipped,
  };
}

export function validateRepositoryArchivePath(fileName: string): string[] {
  return validateEntryPath(fileName).segments;
}

export function shouldSkipRepositorySourceFile(filePath: string): boolean {
  return shouldSkipSourceFile(filePath);
}

async function readSourceEntry(
  zipFile: ZipFile,
  entry: Entry,
  filePath: string,
  limits: GitHubAnalysisLimits,
  combinedSourceBytes: number,
): Promise<ExpressProjectFile> {
  if (entry.uncompressedSize > limits.maximumFileBytes) {
    throw new GitHubAnalysisError(
      'REPOSITORY_TOO_LARGE',
      'The source file "' + filePath + '" exceeds the 512 KiB file limit.',
    );
  }

  if (
    combinedSourceBytes + entry.uncompressedSize >
    limits.maximumCombinedSourceBytes
  ) {
    throw new GitHubAnalysisError(
      'REPOSITORY_TOO_LARGE',
      'The repository exceeds the 5 MiB combined source limit.',
    );
  }

  let readStream: Readable;

  try {
    readStream = await zipFile.openReadStreamPromise(entry);
  } catch (error) {
    throw invalidArchive(error);
  }

  const chunks: Buffer[] = [];
  let actualBytes = 0;

  try {
    for await (const chunk of readStream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      actualBytes += buffer.length;

      if (
        actualBytes > limits.maximumFileBytes ||
        combinedSourceBytes + actualBytes > limits.maximumCombinedSourceBytes
      ) {
        readStream.destroy();
        throw new GitHubAnalysisError(
          'REPOSITORY_TOO_LARGE',
          'Repository source files exceed the configured size limits.',
        );
      }

      chunks.push(buffer);
    }
  } catch (error) {
    if (error instanceof GitHubAnalysisError) {
      throw error;
    }

    throw invalidArchive(error);
  }

  return {
    filePath,
    sourceCode: Buffer.concat(chunks, actualBytes).toString('utf8'),
  };
}

function readNextEntry(zipFile: ZipFile): Promise<Entry | null> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      zipFile.off('entry', handleEntry);
      zipFile.off('end', handleEnd);
      zipFile.off('error', handleError);
    };
    const handleEntry = (entry: Entry) => {
      cleanup();
      resolve(entry);
    };
    const handleEnd = () => {
      cleanup();
      resolve(null);
    };
    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };

    zipFile.once('entry', handleEntry);
    zipFile.once('end', handleEnd);
    zipFile.once('error', handleError);
    zipFile.readEntry();
  });
}

function validateEntryPath(fileName: string): {
  segments: string[];
  isDirectory: boolean;
} {
  if (
    fileName.includes('\0') ||
    fileName.includes('\\') ||
    fileName.startsWith('/') ||
    /^[A-Za-z]:/.test(fileName)
  ) {
    throw invalidArchive();
  }

  const isDirectory = fileName.endsWith('/');
  const pathWithoutTrailingSlash = isDirectory
    ? fileName.slice(0, -1)
    : fileName;
  const segments = pathWithoutTrailingSlash.split('/');

  if (
    segments.length === 0 ||
    segments.some(
      (segment) => segment.length === 0 || segment === '.' || segment === '..',
    )
  ) {
    throw invalidArchive();
  }

  return {
    segments,
    isDirectory,
  };
}

function shouldSkipSourceFile(filePath: string): boolean {
  const segments = filePath.split('/');
  const directorySegments = segments.slice(0, -1);

  return (
    directorySegments.some((segment) =>
      excludedDirectories.has(segment.toLowerCase()),
    ) ||
    declarationFile.test(filePath) ||
    minifiedFile.test(filePath)
  );
}

function isDirectoryEntry(entry: Entry): boolean {
  return getUnixFileType(entry) === 0o040000;
}

function isSymbolicLink(entry: Entry): boolean {
  return getUnixFileType(entry) === 0o120000;
}

function getUnixFileType(entry: Entry): number {
  return (entry.externalFileAttributes >>> 16) & 0o170000;
}

function invalidArchive(cause?: unknown): GitHubAnalysisError {
  return new GitHubAnalysisError(
    'INVALID_REPOSITORY_ARCHIVE',
    'GitHub returned an invalid repository archive.',
    { cause },
  );
}
