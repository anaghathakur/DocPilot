import { stringify } from 'yaml';

import { OpenApiGenerationError } from './errors.js';
import { createOperationIdAllocator } from './operation-ids.js';
import { convertRoutePath } from './path-parameters.js';
import { createOperationSummary } from './summaries.js';
import type {
  GenerateOpenApiInput,
  GenerateOpenApiResult,
  OpenApiDocument,
  OpenApiGenerationWarning,
  OpenApiOperation,
  OpenApiOperationMethod,
  OpenApiRouteInput,
  OpenApiRouteMethod,
} from './types.js';

export const defaultOpenApiTitle = 'DocPilot Generated API';
export const defaultOpenApiVersion = '1.0.0';
export const maximumOpenApiRoutes = 500;

const supportedMethods = new Set<OpenApiRouteMethod>([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]);

export function generateOpenApi(
  input: GenerateOpenApiInput,
): GenerateOpenApiResult {
  validateInput(input);

  const title = input.title?.trim() || defaultOpenApiTitle;
  const version = input.version?.trim() || defaultOpenApiVersion;
  const serverUrl = input.serverUrl?.trim();
  const document: OpenApiDocument = {
    openapi: '3.1.0',
    info: {
      title,
      version,
    },
    ...(serverUrl === undefined || serverUrl.length === 0
      ? {}
      : { servers: [{ url: serverUrl }] }),
    paths: {},
  };
  const warnings: OpenApiGenerationWarning[] = [];
  const retainedOperations = new Map<string, number>();
  const allocateOperationId = createOperationIdAllocator();

  input.routes.forEach((route, routeIndex) => {
    const conversion = convertRoutePath(route.path, route.method, routeIndex);

    if (!conversion.success) {
      warnings.push(conversion.warning);
      return;
    }

    const operationKey = route.method + ' ' + conversion.path;
    const retainedRouteIndex = retainedOperations.get(operationKey);

    if (retainedRouteIndex !== undefined) {
      warnings.push({
        code: 'DUPLICATE_OPERATION',
        method: route.method,
        path: conversion.path,
        keptRouteIndex: retainedRouteIndex,
        ignoredRouteIndex: routeIndex,
        message:
          route.method +
          ' ' +
          conversion.path +
          ' duplicates an earlier operation and was ignored.',
      });
      return;
    }

    retainedOperations.set(operationKey, routeIndex);

    const operationMethod =
      route.method.toLowerCase() as OpenApiOperationMethod;
    const operation: OpenApiOperation = {
      summary: createOperationSummary(
        route.method,
        route.handler,
        conversion.staticSegments,
      ),
      operationId: allocateOperationId(
        route.method,
        route.handler,
        conversion.path,
      ),
      ...(conversion.parameters.length === 0
        ? {}
        : { parameters: conversion.parameters }),
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
      'x-docpilot-handler': route.handler,
      'x-docpilot-middleware': [...route.middleware],
      ...(route.filePath === undefined
        ? {}
        : { 'x-docpilot-file': route.filePath }),
    };

    const pathItem = document.paths[conversion.path];

    if (pathItem === undefined) {
      document.paths[conversion.path] = {
        [operationMethod]: operation,
      };
    } else {
      pathItem[operationMethod] = operation;
    }
  });

  const json = withFinalNewline(JSON.stringify(document, null, 2));
  const yaml = withFinalNewline(
    stringify(document, {
      aliasDuplicateObjects: false,
      lineWidth: 0,
    }),
  );

  return {
    document,
    json,
    yaml,
    warnings,
  };
}

function validateInput(input: GenerateOpenApiInput): void {
  if (!Array.isArray(input.routes) || input.routes.length === 0) {
    throw new OpenApiGenerationError('routes must be a non-empty array');
  }

  if (input.routes.length > maximumOpenApiRoutes) {
    throw new OpenApiGenerationError(
      'routes must contain no more than 500 items',
    );
  }

  input.routes.forEach(validateRoute);

  if (input.serverUrl !== undefined && input.serverUrl.trim().length > 0) {
    let serverUrl: URL;

    try {
      serverUrl = new URL(input.serverUrl.trim());
    } catch {
      throw new OpenApiGenerationError(
        'serverUrl must be a valid HTTP or HTTPS URL',
      );
    }

    if (serverUrl.protocol !== 'http:' && serverUrl.protocol !== 'https:') {
      throw new OpenApiGenerationError(
        'serverUrl must be a valid HTTP or HTTPS URL',
      );
    }
  }
}

function validateRoute(route: OpenApiRouteInput, index: number): void {
  if (!supportedMethods.has(route.method)) {
    throw new OpenApiGenerationError(
      'routes[' + String(index) + '].method is unsupported',
    );
  }

  if (
    typeof route.path !== 'string' ||
    route.path.length === 0 ||
    !route.path.startsWith('/')
  ) {
    throw new OpenApiGenerationError(
      'routes[' + String(index) + '].path must start with /',
    );
  }

  if (typeof route.handler !== 'string') {
    throw new OpenApiGenerationError(
      'routes[' + String(index) + '].handler must be a string',
    );
  }

  if (
    !Array.isArray(route.middleware) ||
    route.middleware.some((middleware) => typeof middleware !== 'string')
  ) {
    throw new OpenApiGenerationError(
      'routes[' + String(index) + '].middleware must be an array of strings',
    );
  }
}

function withFinalNewline(value: string): string {
  return value.endsWith('\n') ? value : value + '\n';
}
