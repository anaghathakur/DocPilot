import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AnalyzeProjectApiError,
  analyzeProject,
  type AnalyzeProjectResponse,
} from '../lib/analyze-project';

function createResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('analyzeProject', () => {
  it('normalizes the API URL and returns a validated project response', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.test///');
    const payload: AnalyzeProjectResponse = {
      routes: [
        {
          method: 'GET',
          path: '/users',
          middleware: ['authMiddleware'],
          handler: 'getUsers',
          filePath: 'routes/users.ts',
        },
      ],
      routeCount: 1,
      filesAnalyzed: 1,
      filesSkipped: [],
      errors: [],
    };
    const fetcher = vi.fn().mockResolvedValue(createResponse(payload));

    const result = await analyzeProject(
      {
        files: [
          {
            filePath: 'routes/users.ts',
            sourceCode: "router.get('/users', authMiddleware, getUsers);",
          },
        ],
      },
      fetcher as typeof fetch,
    );

    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example.test/analyze/project',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );
    expect(result).toEqual(payload);
  });

  it('surfaces clean API errors', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      createResponse(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'duplicate filePath: routes/users.ts',
          },
        },
        400,
      ),
    );

    await expect(
      analyzeProject(
        {
          files: [
            { filePath: 'routes/users.ts', sourceCode: 'const value = 1;' },
          ],
        },
        fetcher as typeof fetch,
      ),
    ).rejects.toMatchObject({
      name: 'AnalyzeProjectApiError',
      code: 'INVALID_REQUEST',
      status: 400,
      message: 'duplicate filePath: routes/users.ts',
    });
  });

  it('rejects malformed successful responses', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      createResponse({
        routes: [],
        routeCount: 1,
        filesAnalyzed: 1,
        filesSkipped: [],
        errors: [],
      }),
    );

    await expect(
      analyzeProject(
        {
          files: [
            { filePath: 'routes/users.ts', sourceCode: 'const value = 1;' },
          ],
        },
        fetcher as typeof fetch,
      ),
    ).rejects.toEqual(
      expect.objectContaining({
        message: 'The API returned an invalid response.',
      }),
    );
  });

  it('returns a useful message when the API cannot be reached', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValue(new TypeError('Network request failed'));

    await expect(
      analyzeProject(
        {
          files: [
            { filePath: 'routes/users.ts', sourceCode: 'const value = 1;' },
          ],
        },
        fetcher as typeof fetch,
      ),
    ).rejects.toEqual(
      new AnalyzeProjectApiError(
        'Unable to reach the DocPilot API. Make sure it is running and try again.',
      ),
    );
  });
});
