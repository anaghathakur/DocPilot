import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { GitHubAnalysisLimits } from '../src/github-config.js';
import {
  readRepositoryArchive,
  shouldSkipRepositorySourceFile,
  validateRepositoryArchivePath,
} from '../src/repository-archive.js';
import { writeZipFixture } from './zip-fixture.js';

const directories: string[] = [];
const limits: GitHubAnalysisLimits = {
  metadataTimeoutMs: 100,
  archiveTimeoutMs: 100,
  maximumArchiveBytes: 10_000,
  maximumFileBytes: 1_000,
  maximumCombinedSourceBytes: 2_000,
  maximumSupportedFiles: 100,
  maximumArchiveEntries: 100,
};

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('repository archive inspection', () => {
  it('streams supported files and skips excluded, minified, declaration, and symlink entries', async () => {
    const archivePath = await createArchive([
      {
        name: 'owner-repo/src/routes.ts',
        content: "router.get('/users', getUsers);",
      },
      {
        name: 'owner-repo/NODE_MODULES/vendor.js',
        content: 'ignored',
      },
      { name: 'owner-repo/src/client.MIN.JS', content: 'ignored' },
      { name: 'owner-repo/src/types.D.TS', content: 'ignored' },
      {
        name: 'owner-repo/src/link.ts',
        content: 'routes.ts',
        mode: 0o120777,
      },
      { name: 'owner-repo/README.md', content: 'ignored' },
    ]);

    await expect(readRepositoryArchive(archivePath, limits)).resolves.toEqual({
      files: [
        {
          filePath: 'src/routes.ts',
          sourceCode: "router.get('/users', getUsers);",
        },
      ],
      filesSkipped: [
        'NODE_MODULES/vendor.js',
        'src/client.MIN.JS',
        'src/types.D.TS',
        'src/link.ts',
      ],
    });
  });

  it.each([
    '/root/file.ts',
    'C:/root/file.ts',
    'root\\file.ts',
    'root/../file.ts',
    'root/./file.ts',
    'root//file.ts',
    'root/\0file.ts',
  ])('rejects unsafe path %s', (filePath) => {
    expect(() => validateRepositoryArchivePath(filePath)).toThrowError(
      expect.objectContaining({ code: 'INVALID_REPOSITORY_ARCHIVE' }),
    );
  });

  it('rejects entries outside the single archive root', async () => {
    const archivePath = await createArchive([
      { name: 'first/routes.ts', content: 'const first = true;' },
      { name: 'second/routes.ts', content: 'const second = true;' },
    ]);

    await expect(
      readRepositoryArchive(archivePath, limits),
    ).rejects.toMatchObject({ code: 'INVALID_REPOSITORY_ARCHIVE' });
  });

  it('enforces supported-file, per-file, combined-source, and entry limits', async () => {
    const twoFiles = await createArchive([
      { name: 'root/a.ts', content: 'a' },
      { name: 'root/b.ts', content: 'b' },
    ]);
    await expect(
      readRepositoryArchive(twoFiles, { ...limits, maximumSupportedFiles: 1 }),
    ).rejects.toMatchObject({ code: 'REPOSITORY_TOO_LARGE' });

    const largeFile = await createArchive([
      { name: 'root/a.ts', content: '12345' },
    ]);
    await expect(
      readRepositoryArchive(largeFile, { ...limits, maximumFileBytes: 4 }),
    ).rejects.toMatchObject({ code: 'REPOSITORY_TOO_LARGE' });

    await expect(
      readRepositoryArchive(twoFiles, {
        ...limits,
        maximumCombinedSourceBytes: 1,
      }),
    ).rejects.toMatchObject({ code: 'REPOSITORY_TOO_LARGE' });

    await expect(
      readRepositoryArchive(twoFiles, { ...limits, maximumArchiveEntries: 1 }),
    ).rejects.toMatchObject({ code: 'REPOSITORY_TOO_LARGE' });
  });

  it('rejects malformed archives', async () => {
    const directory = await createDirectory();
    const archivePath = join(directory, 'invalid.zip');
    await writeFile(archivePath, 'not a zip');

    await expect(
      readRepositoryArchive(archivePath, limits),
    ).rejects.toMatchObject({ code: 'INVALID_REPOSITORY_ARCHIVE' });
  });

  it('matches excluded directories and file names case-insensitively', () => {
    expect(shouldSkipRepositorySourceFile('BUILD/output.ts')).toBe(true);
    expect(shouldSkipRepositorySourceFile('src/value.MIN.TSX')).toBe(true);
    expect(shouldSkipRepositorySourceFile('src/types.D.TS')).toBe(true);
    expect(shouldSkipRepositorySourceFile('src/routes.ts')).toBe(false);
  });
});

async function createArchive(
  entries: Parameters<typeof writeZipFixture>[1],
): Promise<string> {
  const directory = await createDirectory();
  const archivePath = join(directory, 'repository.zip');
  await writeZipFixture(archivePath, entries);
  return archivePath;
}

async function createDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'docpilot-archive-test-'));
  directories.push(directory);
  return directory;
}
