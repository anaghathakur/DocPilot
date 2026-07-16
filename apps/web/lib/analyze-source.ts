import {
  isExpressRoute,
  isRecord,
  postJson,
  type ApiErrorDetails,
  type ExpressRoute,
} from './api-client';

export type { ExpressHttpMethod, ExpressRoute } from './api-client';

export interface AnalyzeSourceRequest {
  sourceCode: string;
  filename: string;
}

export interface AnalyzeSourceResponse {
  routes: ExpressRoute[];
  count: number;
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

export function analyzeSource(
  input: AnalyzeSourceRequest,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<AnalyzeSourceResponse> {
  return postJson(
    '/analyze/source',
    input,
    isAnalyzeSourceResponse,
    (message, details) => new AnalyzeSourceApiError(message, details),
    fetcher,
  );
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
