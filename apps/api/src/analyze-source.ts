import {
  ExpressRouteParserError,
  extractExpressRoutes,
} from '@docpilot/parser';
import type { NextFunction, Request, Response } from 'express';

export type ApiErrorCode =
  | 'INVALID_REQUEST'
  | 'INVALID_SOURCE_CODE'
  | 'INTERNAL_ERROR'
  | 'INVALID_REPOSITORY_URL'
  | 'REPOSITORY_NOT_ACCESSIBLE'
  | 'PRIVATE_REPOSITORY'
  | 'GITHUB_RATE_LIMITED'
  | 'REPOSITORY_TOO_LARGE'
  | 'GITHUB_TIMEOUT'
  | 'GITHUB_UNAVAILABLE'
  | 'INVALID_REPOSITORY_ARCHIVE';

export interface ApiErrorMetadata {
  rateLimitReset?: string;
}

interface AnalyzeSourceInput {
  sourceCode: string;
  filename: string;
}

type ValidationResult =
  | {
      success: true;
      value: AnalyzeSourceInput;
    }
  | {
      success: false;
      message: string;
    };

export function analyzeSource(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const validation = validateRequestBody(request.body);

  if (!validation.success) {
    sendError(response, 400, 'INVALID_REQUEST', validation.message);
    return;
  }

  const { sourceCode, filename } = validation.value;

  try {
    const routes = extractExpressRoutes(sourceCode, {
      filePath: filename,
    });

    response.status(200).json({
      routes,
      count: routes.length,
    });
  } catch (error) {
    if (error instanceof ExpressRouteParserError) {
      sendError(response, 422, 'INVALID_SOURCE_CODE', error.message);
      return;
    }

    next(error);
  }
}

export function sendError(
  response: Response,
  status: number,
  code: ApiErrorCode,
  message: string,
  metadata: ApiErrorMetadata = {},
): void {
  response.status(status).json({
    error: {
      code,
      message,
      ...(metadata.rateLimitReset === undefined
        ? {}
        : { rateLimitReset: metadata.rateLimitReset }),
    },
  });
}

function validateRequestBody(body: unknown): ValidationResult {
  if (
    !isRecord(body) ||
    typeof body.sourceCode !== 'string' ||
    body.sourceCode.trim().length === 0
  ) {
    return {
      success: false,
      message: 'sourceCode must be a non-empty string',
    };
  }

  if (
    body.filename !== undefined &&
    (typeof body.filename !== 'string' || body.filename.trim().length === 0)
  ) {
    return {
      success: false,
      message: 'filename must be a non-empty string when provided',
    };
  }

  return {
    success: true,
    value: {
      sourceCode: body.sourceCode,
      filename: typeof body.filename === 'string' ? body.filename : 'routes.ts',
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
