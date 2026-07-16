import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { analyzeExpressProject } from '@docpilot/parser';
import type { ExpressProjectAnalysisResult } from '@docpilot/parser';

import { createGitHubClient } from './github-client.js';
import type {
  GitHubClient,
  GitHubRepositoryMetadata,
} from './github-client.js';
import {
  loadGitHubAnalysisLimits,
  type GitHubAnalysisLimits,
} from './github-config.js';
import { parseGitHubRepositoryUrl } from './github-url.js';
import { readRepositoryArchive } from './repository-archive.js';
import type { RepositoryArchiveContents } from './repository-archive.js';

export type RepositoryArchiveReader = (
  archivePath: string,
  limits: GitHubAnalysisLimits,
) => Promise<RepositoryArchiveContents>;

export interface GitHubRepositoryAnalysisResult extends ExpressProjectAnalysisResult {
  repository: GitHubRepositoryMetadata;
}

export interface GitHubRepositoryAnalyzer {
  analyze(repositoryUrl: string): Promise<GitHubRepositoryAnalysisResult>;
}

export interface TemporaryRepositoryStorage {
  create(): Promise<{ directoryPath: string; archivePath: string }>;
  cleanup(directoryPath: string): Promise<void>;
}

export interface CreateGitHubRepositoryAnalyzerOptions {
  limits?: GitHubAnalysisLimits;
  githubClient?: GitHubClient;
  archiveReader?: RepositoryArchiveReader;
  temporaryStorage?: TemporaryRepositoryStorage;
  fetcher?: typeof fetch;
}

export function createGitHubRepositoryAnalyzer(
  options: CreateGitHubRepositoryAnalyzerOptions = {},
): GitHubRepositoryAnalyzer {
  const limits = options.limits ?? loadGitHubAnalysisLimits();
  const githubClient =
    options.githubClient ??
    createGitHubClient({
      limits,
      ...(options.fetcher === undefined ? {} : { fetcher: options.fetcher }),
    });
  const archiveReader = options.archiveReader ?? readRepositoryArchive;
  const temporaryStorage = options.temporaryStorage ?? createTemporaryStorage();

  return {
    async analyze(repositoryUrl) {
      const reference = parseGitHubRepositoryUrl(repositoryUrl);
      const repository = await githubClient.getRepositoryMetadata(reference);
      const temporary = await temporaryStorage.create();

      try {
        await githubClient.downloadRepositoryArchive(
          repository,
          repository.defaultBranch,
          temporary.archivePath,
        );
        const archive = await archiveReader(temporary.archivePath, limits);
        const analysis = analyzeExpressProject(archive.files);

        return {
          repository,
          ...analysis,
          filesSkipped: [...archive.filesSkipped, ...analysis.filesSkipped],
        };
      } finally {
        await temporaryStorage.cleanup(temporary.directoryPath).catch(() => {
          // Cleanup must never replace the primary success or failure result.
        });
      }
    },
  };
}

function createTemporaryStorage(): TemporaryRepositoryStorage {
  return {
    async create() {
      const directoryPath = await mkdtemp(join(tmpdir(), 'docpilot-github-'));

      return {
        directoryPath,
        archivePath: join(directoryPath, 'repository.zip'),
      };
    },
    async cleanup(directoryPath) {
      await rm(directoryPath, { recursive: true, force: true });
    },
  };
}
