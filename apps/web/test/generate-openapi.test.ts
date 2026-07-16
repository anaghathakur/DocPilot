import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  GenerateOpenApiApiError,
  generateOpenApi,
  type GenerateOpenApiResponse,
} from '../lib/generate-openapi';

const validResponse: GenerateOpenApiResponse = {
  document: {
    openapi: '3.1.0',
    info: {
      title: 'DocPilot Generated API',
      version: '1.0.0',
    },
    paths: {
      '/users': {
        get: {
          summary: 'Get users',
          operationId: 'getUsers',
          responses: {
            '200': {
              description: 'Successful response',
            },
          },
          'x-docpilot-handler': 'getUsers',
          'x-docpilot-middleware': [],
        },
      },
    },
  },
  json: '{}\n',
  yaml: 'openapi: 3.1.0\n',
  warnings: [],
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('generateOpenApi client', () => {
  it('uses normalized API URL handling and validates a successful response', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.test///');
    const fetcher = vi.fn().mockResolvedValue(createResponse(validResponse));
    const request = {
      routes: [
        {
          method: 'GET' as const,
          path: '/users',
          middleware: [],
          handler: 'getUsers',
        },
      ],
      title: 'Users API',
      version: '1.0.0',
    };

    await expect(
      generateOpenApi(request, fetcher as typeof fetch),
    ).resolves.toEqual(validResponse);
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example.test/generate/openapi',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(request),
      }),
    );
  });

  it('rejects malformed success data', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        createResponse({ ...validResponse, document: { openapi: '3.0.0' } }),
      );

    await expect(
      generateOpenApi(
        {
          routes: [
            {
              method: 'GET',
              path: '/users',
              middleware: [],
              handler: 'getUsers',
            },
          ],
        },
        fetcher as typeof fetch,
      ),
    ).rejects.toMatchObject({
      message: 'The API returned an invalid response.',
    });
  });

  it('surfaces API and network failures', async () => {
    const apiFetcher = vi.fn().mockResolvedValue(
      createResponse(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'routes must be a non-empty array',
          },
        },
        400,
      ),
    );

    await expect(
      generateOpenApi({ routes: [] }, apiFetcher as typeof fetch),
    ).rejects.toMatchObject({
      name: 'GenerateOpenApiApiError',
      status: 400,
      code: 'INVALID_REQUEST',
    });

    await expect(
      generateOpenApi(
        { routes: [] },
        vi.fn().mockRejectedValue(new TypeError('network')) as typeof fetch,
      ),
    ).rejects.toEqual(
      new GenerateOpenApiApiError(
        'Unable to reach the DocPilot API. Make sure it is running and try again.',
      ),
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
