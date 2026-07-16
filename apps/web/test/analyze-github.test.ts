import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AnalyzeGitHubApiError,
  analyzeGitHub,
  validatePublicGitHubRepositoryUrl,
  type AnalyzeGitHubResponse,
} from '../lib/analyze-github';

const response: AnalyzeGitHubResponse = {
  repository: {
    owner: 'owner',
    name: 'repository',
    url: 'https://github.com/owner/repository',
    defaultBranch: 'trunk',
  },
  routes: [],
  routeCount: 0,
  filesAnalyzed: 1,
  filesSkipped: [],
  errors: [],
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('analyzeGitHub', () => {
  it('uses the normalized API base URL and validates the response', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.test///');
    const fetcher = vi.fn().mockResolvedValue(createResponse(response));

    await expect(
      analyzeGitHub(
        { repositoryUrl: 'https://github.com/owner/repository' },
        fetcher as typeof fetch,
      ),
    ).resolves.toEqual(response);

    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example.test/analyze/github',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          repositoryUrl: 'https://github.com/owner/repository',
        }),
      }),
    );
  });

  it('surfaces clean API and network errors', async () => {
    const apiFetcher = vi.fn().mockResolvedValue(
      createResponse(
        {
          error: {
            code: 'REPOSITORY_NOT_ACCESSIBLE',
            message: 'The repository was not found or is private.',
          },
        },
        404,
      ),
    );

    await expect(
      analyzeGitHub(
        { repositoryUrl: 'https://github.com/owner/repository' },
        apiFetcher as typeof fetch,
      ),
    ).rejects.toMatchObject({
      name: 'AnalyzeGitHubApiError',
      code: 'REPOSITORY_NOT_ACCESSIBLE',
      status: 404,
    });

    await expect(
      analyzeGitHub(
        { repositoryUrl: 'https://github.com/owner/repository' },
        vi.fn().mockRejectedValue(new TypeError('network')) as typeof fetch,
      ),
    ).rejects.toEqual(
      new AnalyzeGitHubApiError(
        'Unable to reach the DocPilot API. Make sure it is running and try again.',
      ),
    );
  });

  it('rejects malformed successful responses', async () => {
    await expect(
      analyzeGitHub(
        { repositoryUrl: 'https://github.com/owner/repository' },
        vi
          .fn()
          .mockResolvedValue(
            createResponse({ ...response, repository: { owner: 'owner' } }),
          ) as typeof fetch,
      ),
    ).rejects.toMatchObject({
      message: 'The API returned an invalid response.',
    });
  });
});

describe('validatePublicGitHubRepositoryUrl', () => {
  it.each([
    [
      'https://github.com/owner/repository/',
      'https://github.com/owner/repository',
    ],
    [
      'https://github.com/owner/repository.git',
      'https://github.com/owner/repository',
    ],
  ])('normalizes %s', (input, expected) => {
    expect(validatePublicGitHubRepositoryUrl(input)).toBe(expected);
  });

  it.each([
    'https://example.com/owner/repository',
    'http://github.com/owner/repository',
    'https://github.com/owner',
    'https://github.com/owner/repository/issues',
    'not a url',
  ])('rejects %s', (input) => {
    expect(() => validatePublicGitHubRepositoryUrl(input)).toThrow(
      'Enter a public GitHub repository URL',
    );
  });
});

function createResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response;
}
