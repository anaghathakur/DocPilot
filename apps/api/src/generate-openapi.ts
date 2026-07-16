import {
  generateOpenApi,
  maximumOpenApiRoutes,
  OpenApiGenerationError,
} from '@docpilot/openapi';
import type {
  GenerateOpenApiInput,
  OpenApiRouteInput,
  OpenApiRouteMethod,
} from '@docpilot/openapi';
import type { NextFunction, Request, Response } from 'express';

import { sendError } from './analyze-source.js';

const supportedMethods = new Set<OpenApiRouteMethod>([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]);
const maximumTitleLength = 200;
const maximumVersionLength = 100;
const maximumPathLength = 2_048;
const maximumServerUrlLength = 2_048;

type ValidationResult =
  | {
      success: true;
      value: GenerateOpenApiInput;
    }
  | {
      success: false;
      message: string;
    };

export function generateOpenApiDocument(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const validation = validateRequestBody(request.body);

  if (!validation.success) {
    sendError(response, 400, 'INVALID_REQUEST', validation.message);
    return;
  }

  try {
    response.status(200).json(generateOpenApi(validation.value));
  } catch (error) {
    if (error instanceof OpenApiGenerationError) {
      sendError(response, 400, 'INVALID_REQUEST', error.message);
      return;
    }

    next(error);
  }
}

function validateRequestBody(body: unknown): ValidationResult {
  if (
    !isRecord(body) ||
    !Array.isArray(body.routes) ||
    body.routes.length === 0
  ) {
    return {
      success: false,
      message: 'routes must be a non-empty array',
    };
  }

  if (body.routes.length > maximumOpenApiRoutes) {
    return {
      success: false,
      message: 'routes must contain no more than 500 items',
    };
  }

  const routes: OpenApiRouteInput[] = [];

  for (const [index, value] of body.routes.entries()) {
    const route = validateRoute(value, index);

    if (!route.success) {
      return route;
    }

    routes.push(route.value);
  }

  const title = validateOptionalText(body.title, 'title', maximumTitleLength);

  if (!title.success) {
    return title;
  }

  const version = validateOptionalText(
    body.version,
    'version',
    maximumVersionLength,
  );

  if (!version.success) {
    return version;
  }

  const serverUrl = validateServerUrl(body.serverUrl);

  if (!serverUrl.success) {
    return serverUrl;
  }

  return {
    success: true,
    value: {
      routes,
      ...(title.value === undefined ? {} : { title: title.value }),
      ...(version.value === undefined ? {} : { version: version.value }),
      ...(serverUrl.value === undefined ? {} : { serverUrl: serverUrl.value }),
    },
  };
}

function validateRoute(
  value: unknown,
  index: number,
):
  | { success: true; value: OpenApiRouteInput }
  | { success: false; message: string } {
  if (
    !isRecord(value) ||
    typeof value.method !== 'string' ||
    !supportedMethods.has(value.method as OpenApiRouteMethod)
  ) {
    return {
      success: false,
      message:
        'routes[' +
        String(index) +
        '].method must be GET, POST, PUT, PATCH, or DELETE',
    };
  }

  if (
    typeof value.path !== 'string' ||
    value.path.length === 0 ||
    value.path !== value.path.trim() ||
    !value.path.startsWith('/') ||
    value.path.length > maximumPathLength ||
    value.path.includes('\0') ||
    /\s/.test(value.path) ||
    value.path.includes('//')
  ) {
    return {
      success: false,
      message:
        'routes[' +
        String(index) +
        '].path must be a valid non-empty path beginning with /',
    };
  }

  if (typeof value.handler !== 'string') {
    return {
      success: false,
      message: 'routes[' + String(index) + '].handler must be a string',
    };
  }

  if (
    !Array.isArray(value.middleware) ||
    value.middleware.some((middleware) => typeof middleware !== 'string')
  ) {
    return {
      success: false,
      message:
        'routes[' + String(index) + '].middleware must be an array of strings',
    };
  }

  if (
    value.filePath !== undefined &&
    (typeof value.filePath !== 'string' || value.filePath.trim().length === 0)
  ) {
    return {
      success: false,
      message:
        'routes[' +
        String(index) +
        '].filePath must be a non-empty string when provided',
    };
  }

  return {
    success: true,
    value: {
      method: value.method as OpenApiRouteMethod,
      path: value.path,
      handler: value.handler,
      middleware: [...value.middleware],
      ...(typeof value.filePath === 'string'
        ? { filePath: value.filePath }
        : {}),
    },
  };
}

function validateOptionalText(
  value: unknown,
  name: 'title' | 'version',
  maximumLength: number,
):
  | { success: true; value: string | undefined }
  | { success: false; message: string } {
  if (value === undefined) {
    return {
      success: true,
      value: undefined,
    };
  }

  if (typeof value !== 'string') {
    return {
      success: false,
      message: name + ' must be a string when provided',
    };
  }

  const trimmed = value.trim();

  if (trimmed.length > maximumLength) {
    return {
      success: false,
      message:
        name +
        ' must contain no more than ' +
        String(maximumLength) +
        ' characters',
    };
  }

  return {
    success: true,
    value: trimmed,
  };
}

function validateServerUrl(
  value: unknown,
):
  | { success: true; value: string | undefined }
  | { success: false; message: string } {
  if (value === undefined) {
    return {
      success: true,
      value: undefined,
    };
  }

  if (typeof value !== 'string') {
    return {
      success: false,
      message: 'serverUrl must be a string when provided',
    };
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return {
      success: true,
      value: undefined,
    };
  }

  if (trimmed.length > maximumServerUrlLength) {
    return {
      success: false,
      message: 'serverUrl must contain no more than 2048 characters',
    };
  }

  let serverUrl: URL;

  try {
    serverUrl = new URL(trimmed);
  } catch {
    return invalidServerUrl();
  }

  if (serverUrl.protocol !== 'http:' && serverUrl.protocol !== 'https:') {
    return invalidServerUrl();
  }

  return {
    success: true,
    value: trimmed,
  };
}

function invalidServerUrl(): { success: false; message: string } {
  return {
    success: false,
    message: 'serverUrl must be a valid HTTP or HTTPS URL',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
