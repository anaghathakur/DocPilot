import { describe, expect, it, vi } from 'vitest';

import { createGitHubRepositoryAnalyzer } from '../src/github-repository-analyzer.js';
import type {
  GitHubClient,
  GitHubRepositoryMetadata,
} from '../src/github-client.js';
import type { GitHubAnalysisLimits } from '../src/github-config.js';
import { GitHubAnalysisError } from '../src/github-errors.js';

const metadata: GitHubRepositoryMetadata = {
  owner: 'owner',
  name: 'repository',
  url: 'https://github.com/owner/repository',
  defaultBranch: 'main',
};
const limits: GitHubAnalysisLimits = {
  metadataTimeoutMs: 1,
  archiveTimeoutMs: 1,
  maximumArchiveBytes: 1,
  maximumFileBytes: 1,
  maximumCombinedSourceBytes: 1,
  maximumSupportedFiles: 100,
  maximumArchiveEntries: 1,
};

describe('GitHub repository analyzer cleanup', () => {
  it('reuses project analysis and cleans temporary storage after success', async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const analyzer = createGitHubRepositoryAnalyzer({
      limits,
      githubClient: createClient(),
      archiveReader: vi.fn().mockResolvedValue({
        files: [
          {
            filePath: 'src/routes.ts',
            sourceCode: "router.get('/users', getUsers);",
          },
        ],
        filesSkipped: ['dist/output.js'],
      }),
      temporaryStorage: {
        create: vi.fn().mockResolvedValue({
          directoryPath: 'temporary',
          archivePath: 'temporary/repository.zip',
        }),
        cleanup,
      },
    });

    await expect(
      analyzer.analyze('https://github.com/owner/repository'),
    ).resolves.toMatchObject({
      repository: metadata,
      routeCount: 1,
      filesAnalyzed: 1,
      filesSkipped: ['dist/output.js'],
      routes: [
        {
          method: 'GET',
          path: '/users',
          filePath: 'src/routes.ts',
        },
      ],
    });
    expect(cleanup).toHaveBeenCalledWith('temporary');
  });

  it.each(['download', 'archive'])(
    'cleans temporary storage after a %s failure',
    async (failurePoint) => {
      const cleanup = vi.fn().mockResolvedValue(undefined);
      const failure = new GitHubAnalysisError(
        failurePoint === 'download'
          ? 'GITHUB_UNAVAILABLE'
          : 'INVALID_REPOSITORY_ARCHIVE',
        'primary failure',
      );
      const client = createClient();

      if (failurePoint === 'download') {
        client.downloadRepositoryArchive = vi.fn().mockRejectedValue(failure);
      }

      const analyzer = createGitHubRepositoryAnalyzer({
        limits,
        githubClient: client,
        archiveReader:
          failurePoint === 'archive'
            ? vi.fn().mockRejectedValue(failure)
            : vi.fn().mockResolvedValue({ files: [], filesSkipped: [] }),
        temporaryStorage: {
          create: vi.fn().mockResolvedValue({
            directoryPath: 'temporary',
            archivePath: 'temporary/repository.zip',
          }),
          cleanup,
        },
      });

      await expect(
        analyzer.analyze('https://github.com/owner/repository'),
      ).rejects.toBe(failure);
      expect(cleanup).toHaveBeenCalledWith('temporary');
    },
  );

  it('does not let cleanup failure replace a successful result', async () => {
    const analyzer = createGitHubRepositoryAnalyzer({
      limits,
      githubClient: createClient(),
      archiveReader: vi.fn().mockResolvedValue({
        files: [],
        filesSkipped: [],
      }),
      temporaryStorage: {
        create: vi.fn().mockResolvedValue({
          directoryPath: 'temporary',
          archivePath: 'temporary/repository.zip',
        }),
        cleanup: vi.fn().mockRejectedValue(new Error('cleanup failed')),
      },
    });

    await expect(
      analyzer.analyze('https://github.com/owner/repository'),
    ).resolves.toMatchObject({ routeCount: 0 });
  });
});

function createClient(): GitHubClient {
  return {
    getRepositoryMetadata: vi.fn().mockResolvedValue(metadata),
    downloadRepositoryArchive: vi.fn().mockResolvedValue(undefined),
  };
}
