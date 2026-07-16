export type OpenApiRouteMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type OpenApiOperationMethod =
  'get' | 'post' | 'put' | 'patch' | 'delete';

export interface OpenApiRouteInput {
  method: OpenApiRouteMethod;
  path: string;
  middleware: string[];
  handler: string;
  filePath?: string;
}

export interface GenerateOpenApiInput {
  routes: OpenApiRouteInput[];
  title?: string;
  version?: string;
  serverUrl?: string;
}

export interface OpenApiInfo {
  title: string;
  version: string;
}

export interface OpenApiServer {
  url: string;
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

export type OpenApiPathItem = Partial<
  Record<OpenApiOperationMethod, OpenApiOperation>
>;

export interface OpenApiDocument {
  openapi: '3.1.0';
  info: OpenApiInfo;
  servers?: OpenApiServer[];
  paths: Record<string, OpenApiPathItem>;
}

export interface DuplicateOperationWarning {
  code: 'DUPLICATE_OPERATION';
  method: OpenApiRouteMethod;
  path: string;
  keptRouteIndex: number;
  ignoredRouteIndex: number;
  message: string;
}

export interface UnsupportedPathWarning {
  code: 'UNSUPPORTED_PATH';
  method: OpenApiRouteMethod;
  path: string;
  routeIndex: number;
  message: string;
}

export type OpenApiGenerationWarning =
  DuplicateOperationWarning | UnsupportedPathWarning;

export interface GenerateOpenApiResult {
  document: OpenApiDocument;
  json: string;
  yaml: string;
  warnings: OpenApiGenerationWarning[];
}
