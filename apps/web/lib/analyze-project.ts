import {
  isExpressRoute,
  isRecord,
  postJson,
  type ApiErrorDetails,
  type ExpressRoute,
} from './api-client';

export interface AnalyzeProjectFile {
  filePath: string;
  sourceCode: string;
}

export interface ProjectRoute extends ExpressRoute {
  filePath: string;
}

export interface ProjectFileError {
  filePath: string;
  code: 'INVALID_SOURCE_CODE';
  message: string;
}

export interface AnalyzeProjectRequest {
  files: AnalyzeProjectFile[];
}

export interface AnalyzeProjectResponse {
  routes: ProjectRoute[];
  routeCount: number;
  filesAnalyzed: number;
  filesSkipped: string[];
  errors: ProjectFileError[];
}

export class AnalyzeProjectApiError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;

  constructor(message: string, details: ApiErrorDetails = {}) {
    super(message);
    this.name = 'AnalyzeProjectApiError';
    this.status = details.status;
    this.code = details.code;
  }
}

export function analyzeProject(
  input: AnalyzeProjectRequest,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<AnalyzeProjectResponse> {
  return postJson(
    '/analyze/project',
    input,
    isAnalyzeProjectResponse,
    (message, details) => new AnalyzeProjectApiError(message, details),
    fetcher,
  );
}

export function isAnalyzeProjectResponse(
  value: unknown,
): value is AnalyzeProjectResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.routes) &&
    value.routes.every(isProjectRoute) &&
    isNonNegativeInteger(value.routeCount) &&
    value.routeCount === value.routes.length &&
    isNonNegativeInteger(value.filesAnalyzed) &&
    Array.isArray(value.filesSkipped) &&
    value.filesSkipped.every((filePath) => typeof filePath === 'string') &&
    Array.isArray(value.errors) &&
    value.errors.every(isProjectFileError)
  );
}

function isProjectRoute(value: unknown): value is ProjectRoute {
  return (
    isRecord(value) &&
    isExpressRoute(value) &&
    typeof value.filePath === 'string'
  );
}

function isProjectFileError(value: unknown): value is ProjectFileError {
  return (
    isRecord(value) &&
    typeof value.filePath === 'string' &&
    value.code === 'INVALID_SOURCE_CODE' &&
    typeof value.message === 'string'
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
