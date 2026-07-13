import { afterEach, describe, expect, it, vi } from 'vitest';

import { AnalyzeSourceApiError, analyzeSource } from '../lib/analyze-source';

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

describe('analyzeSource', () => {
  it('normalizes trailing API URL slashes and returns typed routes', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.test///');
    const payload = {
      routes: [
        {
          method: 'GET',
          path: '/users',
          middleware: ['authMiddleware'],
          handler: 'getUsers',
        },
      ],
      count: 1,
    };
    const fetcher = vi.fn().mockResolvedValue(createResponse(payload));

    const result = await analyzeSource(
      {
        sourceCode: "router.get('/users', authMiddleware, getUsers);",
        filename: 'routes.ts',
      },
      fetcher as typeof fetch,
    );

    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example.test/analyze/source',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );
    expect(result).toEqual(payload);
  });

  it('surfaces a clean API error message', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      createResponse(
        {
          error: {
            code: 'INVALID_SOURCE_CODE',
            message: 'Unable to parse source code',
          },
        },
        422,
      ),
    );

    await expect(
      analyzeSource(
        {
          sourceCode: 'router.get("/users", handler;',
          filename: 'routes.ts',
        },
        fetcher as typeof fetch,
      ),
    ).rejects.toMatchObject({
      name: 'AnalyzeSourceApiError',
      code: 'INVALID_SOURCE_CODE',
      status: 422,
      message: 'Unable to parse source code',
    });
  });

  it('rejects malformed successful responses', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(createResponse({ routes: [], count: 1 }));

    await expect(
      analyzeSource(
        {
          sourceCode: 'const value = 42;',
          filename: 'routes.ts',
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
      analyzeSource(
        {
          sourceCode: 'app.get("/health", handler);',
          filename: 'routes.ts',
        },
        fetcher as typeof fetch,
      ),
    ).rejects.toEqual(
      new AnalyzeSourceApiError(
        'Unable to reach the DocPilot API. Make sure it is running and try again.',
      ),
    );
  });
});
