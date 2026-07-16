import {
  isExpressRoute,
  isRecord,
  postJson,
  type ApiErrorDetails,
  type ExpressRoute,
} from './api-client';

export interface OpenApiRouteInput extends ExpressRoute {
  filePath?: string;
}

export interface GenerateOpenApiRequest {
  routes: OpenApiRouteInput[];
  title?: string;
  version?: string;
  serverUrl?: string;
}

export interface OpenApiPathParameter {
  name: string;
  in: 'path';
  required: true;
  schema: {
    type: 'string';
  };
}

export interface OpenApiOperation {
  summary: string;
  operationId: string;
  parameters?: OpenApiPathParameter[];
  responses: {
    '200': {
      description: 'Successful response';
    };
  };
  'x-docpilot-handler': string;
  'x-docpilot-middleware': string[];
  'x-docpilot-file'?: string;
}

export type OpenApiOperationMethod =
  'get' | 'post' | 'put' | 'patch' | 'delete';

export type OpenApiPathItem = Partial<
  Record<OpenApiOperationMethod, OpenApiOperation>
>;

export interface OpenApiDocument {
  openapi: '3.1.0';
  info: {
    title: string;
    version: string;
  };
  servers?: Array<{ url: string }>;
  paths: Record<string, OpenApiPathItem>;
}

export type OpenApiGenerationWarning =
  | {
      code: 'DUPLICATE_OPERATION';
      method: ExpressRoute['method'];
      path: string;
      keptRouteIndex: number;
      ignoredRouteIndex: number;
      message: string;
    }
  | {
      code: 'UNSUPPORTED_PATH';
      method: ExpressRoute['method'];
      path: string;
      routeIndex: number;
      message: string;
    };

export interface GenerateOpenApiResponse {
  document: OpenApiDocument;
  json: string;
  yaml: string;
  warnings: OpenApiGenerationWarning[];
}

export class GenerateOpenApiApiError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;

  constructor(message: string, details: ApiErrorDetails = {}) {
    super(message);
    this.name = 'GenerateOpenApiApiError';
    this.status = details.status;
    this.code = details.code;
  }
}

export function generateOpenApi(
  input: GenerateOpenApiRequest,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<GenerateOpenApiResponse> {
  return postJson(
    '/generate/openapi',
    input,
    isGenerateOpenApiResponse,
    (message, details) => new GenerateOpenApiApiError(message, details),
    fetcher,
  );
}

export function countOpenApiOperations(document: OpenApiDocument): number {
  return Object.values(document.paths).reduce(
    (count, pathItem) => count + Object.keys(pathItem).length,
    0,
  );
}

export function listOpenApiOperations(document: OpenApiDocument): Array<{
  method: Uppercase<OpenApiOperationMethod>;
  path: string;
  summary: string;
  operationId: string;
}> {
  const operations: Array<{
    method: Uppercase<OpenApiOperationMethod>;
    path: string;
    summary: string;
    operationId: string;
  }> = [];

  for (const [path, pathItem] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (isOpenApiOperationMethod(method) && operation !== undefined) {
        operations.push({
          method: method.toUpperCase() as Uppercase<OpenApiOperationMethod>,
          path,
          summary: operation.summary,
          operationId: operation.operationId,
        });
      }
    }
  }

  return operations;
}

function isGenerateOpenApiResponse(
  value: unknown,
): value is GenerateOpenApiResponse {
  return (
    isRecord(value) &&
    isOpenApiDocument(value.document) &&
    typeof value.json === 'string' &&
    typeof value.yaml === 'string' &&
    Array.isArray(value.warnings) &&
    value.warnings.every(isOpenApiWarning)
  );
}

function isOpenApiDocument(value: unknown): value is OpenApiDocument {
  return (
    isRecord(value) &&
    value.openapi === '3.1.0' &&
    isRecord(value.info) &&
    typeof value.info.title === 'string' &&
    typeof value.info.version === 'string' &&
    (value.servers === undefined ||
      (Array.isArray(value.servers) &&
        value.servers.every(
          (server) => isRecord(server) && typeof server.url === 'string',
        ))) &&
    isRecord(value.paths) &&
    Object.values(value.paths).every(isOpenApiPathItem)
  );
}

function isOpenApiPathItem(value: unknown): value is OpenApiPathItem {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([method, operation]) =>
        isOpenApiOperationMethod(method) && isOpenApiOperation(operation),
    )
  );
}

function isOpenApiOperation(value: unknown): value is OpenApiOperation {
  return (
    isRecord(value) &&
    typeof value.summary === 'string' &&
    typeof value.operationId === 'string' &&
    value.operationId.length > 0 &&
    (value.parameters === undefined ||
      (Array.isArray(value.parameters) &&
        value.parameters.every(isOpenApiPathParameter))) &&
    isRecord(value.responses) &&
    isRecord(value.responses['200']) &&
    value.responses['200'].description === 'Successful response' &&
    typeof value['x-docpilot-handler'] === 'string' &&
    Array.isArray(value['x-docpilot-middleware']) &&
    value['x-docpilot-middleware'].every(
      (middleware) => typeof middleware === 'string',
    ) &&
    (value['x-docpilot-file'] === undefined ||
      typeof value['x-docpilot-file'] === 'string')
  );
}

function isOpenApiPathParameter(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    value.in === 'path' &&
    value.required === true &&
    isRecord(value.schema) &&
    value.schema.type === 'string'
  );
}

function isOpenApiWarning(value: unknown): boolean {
  if (
    !isRecord(value) ||
    (value.code !== 'DUPLICATE_OPERATION' &&
      value.code !== 'UNSUPPORTED_PATH') ||
    typeof value.method !== 'string' ||
    typeof value.path !== 'string' ||
    typeof value.message !== 'string'
  ) {
    return false;
  }

  return value.code === 'DUPLICATE_OPERATION'
    ? Number.isInteger(value.keptRouteIndex) &&
        Number.isInteger(value.ignoredRouteIndex)
    : Number.isInteger(value.routeIndex);
}

function isOpenApiOperationMethod(
  value: string,
): value is OpenApiOperationMethod {
  return ['get', 'post', 'put', 'patch', 'delete'].includes(value);
}

export function isOpenApiRouteInput(
  value: unknown,
): value is OpenApiRouteInput {
  return (
    isExpressRoute(value) &&
    isRecord(value) &&
    (value.filePath === undefined || typeof value.filePath === 'string')
  );
}
