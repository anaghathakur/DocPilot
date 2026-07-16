import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import { GitHubAnalysisError } from '../src/github-errors.js';
import type { GitHubRepositoryAnalyzer } from '../src/github-repository-analyzer.js';

describe('POST /analyze/github', () => {
  it('returns a successful repository analysis', async () => {
    const analyzer: GitHubRepositoryAnalyzer = {
      analyze: vi.fn().mockResolvedValue({
        repository: {
          owner: 'owner',
          name: 'repository',
          url: 'https://github.com/owner/repository',
          defaultBranch: 'main',
        },
        routes: [],
        routeCount: 0,
        filesAnalyzed: 1,
        filesSkipped: [],
        errors: [],
      }),
    };
    const response = await request(
      createApp({ githubRepositoryAnalyzer: analyzer }),
    )
      .post('/analyze/github')
      .send({ repositoryUrl: 'https://github.com/owner/repository' });

    expect(response.status).toBe(200);
    expect(response.body.repository).toMatchObject({
      owner: 'owner',
      name: 'repository',
      defaultBranch: 'main',
    });
    expect(response.body.routeCount).toBe(0);
  });

  it.each([{}, { repositoryUrl: '' }, { repositoryUrl: 42 }, []])(
    'rejects malformed input %#',
    async (body) => {
      const analyzer: GitHubRepositoryAnalyzer = {
        analyze: vi.fn(),
      };
      const response = await request(
        createApp({ githubRepositoryAnalyzer: analyzer }),
      )
        .post('/analyze/github')
        .send(body);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_REPOSITORY_URL');
      expect(analyzer.analyze).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['REPOSITORY_NOT_ACCESSIBLE', 404],
    ['PRIVATE_REPOSITORY', 400],
    ['GITHUB_RATE_LIMITED', 429],
    ['REPOSITORY_TOO_LARGE', 413],
    ['GITHUB_TIMEOUT', 504],
    ['GITHUB_UNAVAILABLE', 502],
    ['INVALID_REPOSITORY_ARCHIVE', 502],
  ] as const)('maps %s to HTTP %i without internals', async (code, status) => {
    const analyzer: GitHubRepositoryAnalyzer = {
      analyze: vi.fn().mockRejectedValue(
        new GitHubAnalysisError(code, 'Public message', {
          ...(code === 'GITHUB_RATE_LIMITED'
            ? { rateLimitReset: '2026-07-16T12:00:00.000Z' }
            : {}),
          cause: new Error('secret internal detail'),
        }),
      ),
    };
    const response = await request(
      createApp({ githubRepositoryAnalyzer: analyzer }),
    )
      .post('/analyze/github')
      .send({ repositoryUrl: 'https://github.com/owner/repository' });

    expect(response.status).toBe(status);
    expect(response.body.error).toMatchObject({
      code,
      message: 'Public message',
    });
    expect(JSON.stringify(response.body)).not.toContain('secret');
    expect(response.body.error).not.toHaveProperty('stack');
  });
});
