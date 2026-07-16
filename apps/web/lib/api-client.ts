const defaultApiBaseUrl = 'http://localhost:4000';
const supportedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export type ExpressHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ExpressRoute {
  method: ExpressHttpMethod;
  path: string;
  middleware: string[];
  handler: string;
}

export interface ApiErrorDetails {
  status?: number | undefined;
  code?: string | undefined;
}

type ApiErrorFactory = (message: string, details?: ApiErrorDetails) => Error;

export async function postJson<T>(
  path: string,
  body: unknown,
  isResponse: (value: unknown) => value is T,
  createError: ApiErrorFactory,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<T> {
  let response: Response;

  try {
    response = await fetcher(getApiUrl(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw createError(
      'Unable to reach the DocPilot API. Make sure it is running and try again.',
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw createError(
      response.ok
        ? 'The API returned an invalid response.'
        : 'The API returned an unreadable error response.',
      { status: response.status },
    );
  }

  if (!response.ok) {
    const apiError = readApiError(payload);
    throw createError(
      apiError?.message ??
        'The request could not be completed. Please try again.',
      {
        status: response.status,
        code: apiError?.code,
      },
    );
  }

  if (!isResponse(payload)) {
    throw createError('The API returned an invalid response.', {
      status: response.status,
    });
  }

  return payload;
}

export function isExpressRoute(value: unknown): value is ExpressRoute {
  return (
    isRecord(value) &&
    typeof value.method === 'string' &&
    supportedMethods.has(value.method) &&
    typeof value.path === 'string' &&
    Array.isArray(value.middleware) &&
    value.middleware.every((middleware) => typeof middleware === 'string') &&
    typeof value.handler === 'string'
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getApiUrl(path: string): string {
  const configuredBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || defaultApiBaseUrl;
  const baseUrl = configuredBaseUrl.replace(/\/+$/, '') || defaultApiBaseUrl;

  return baseUrl + path;
}

function readApiError(
  value: unknown,
): { code: string | undefined; message: string } | undefined {
  if (!isRecord(value) || !isRecord(value.error)) {
    return undefined;
  }

  if (typeof value.error.message !== 'string') {
    return undefined;
  }

  return {
    code: typeof value.error.code === 'string' ? value.error.code : undefined,
    message: value.error.message,
  };
}
