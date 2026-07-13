const defaultApiBaseUrl = 'http://localhost:4000';
const supportedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export type ExpressHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ExpressRoute {
  method: ExpressHttpMethod;
  path: string;
  middleware: string[];
  handler: string;
}

export interface AnalyzeSourceRequest {
  sourceCode: string;
  filename: string;
}

export interface AnalyzeSourceResponse {
  routes: ExpressRoute[];
  count: number;
}

interface ApiErrorDetails {
  status?: number | undefined;
  code?: string | undefined;
}

export class AnalyzeSourceApiError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;

  constructor(message: string, details: ApiErrorDetails = {}) {
    super(message);
    this.name = 'AnalyzeSourceApiError';
    this.status = details.status;
    this.code = details.code;
  }
}

export async function analyzeSource(
  input: AnalyzeSourceRequest,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<AnalyzeSourceResponse> {
  let response: Response;

  try {
    response = await fetcher(getApiUrl('/analyze/source'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
  } catch {
    throw new AnalyzeSourceApiError(
      'Unable to reach the DocPilot API. Make sure it is running and try again.',
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new AnalyzeSourceApiError(
      response.ok
        ? 'The API returned an invalid response.'
        : 'The API returned an unreadable error response.',
      { status: response.status },
    );
  }

  if (!response.ok) {
    const apiError = readApiError(payload);
    throw new AnalyzeSourceApiError(
      apiError?.message ??
        'The request could not be completed. Please try again.',
      {
        status: response.status,
        code: apiError?.code,
      },
    );
  }

  if (!isAnalyzeSourceResponse(payload)) {
    throw new AnalyzeSourceApiError('The API returned an invalid response.', {
      status: response.status,
    });
  }

  return payload;
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

function isAnalyzeSourceResponse(
  value: unknown,
): value is AnalyzeSourceResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.routes) &&
    value.routes.every(isExpressRoute) &&
    typeof value.count === 'number' &&
    Number.isInteger(value.count) &&
    value.count >= 0 &&
    value.count === value.routes.length
  );
}

function isExpressRoute(value: unknown): value is ExpressRoute {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
