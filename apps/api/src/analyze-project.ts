import { analyzeExpressProject } from '@docpilot/parser';
import type { ExpressProjectFile } from '@docpilot/parser';
import type { NextFunction, Request, Response } from 'express';

import { sendError } from './analyze-source.js';

const maximumProjectFiles = 100;

interface AnalyzeProjectInput {
  files: ExpressProjectFile[];
}

type ValidationResult =
  | {
      success: true;
      value: AnalyzeProjectInput;
    }
  | {
      success: false;
      message: string;
    };

export function analyzeProject(
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
    response.status(200).json(analyzeExpressProject(validation.value.files));
  } catch (error) {
    next(error);
  }
}

function validateRequestBody(body: unknown): ValidationResult {
  if (
    !isRecord(body) ||
    !Array.isArray(body.files) ||
    body.files.length === 0
  ) {
    return {
      success: false,
      message: 'files must be a non-empty array',
    };
  }

  if (body.files.length > maximumProjectFiles) {
    return {
      success: false,
      message: 'files must contain no more than 100 items',
    };
  }

  const files: ExpressProjectFile[] = [];
  const normalizedFilePaths = new Set<string>();

  for (const [index, value] of body.files.entries()) {
    if (
      !isRecord(value) ||
      typeof value.filePath !== 'string' ||
      value.filePath.trim().length === 0
    ) {
      return {
        success: false,
        message:
          'files[' + String(index) + '].filePath must be a non-empty string',
      };
    }

    if (
      typeof value.sourceCode !== 'string' ||
      value.sourceCode.trim().length === 0
    ) {
      return {
        success: false,
        message:
          'files[' + String(index) + '].sourceCode must be a non-empty string',
      };
    }

    const normalizedFilePath = normalizeFilePath(value.filePath);

    if (normalizedFilePaths.has(normalizedFilePath)) {
      return {
        success: false,
        message: 'duplicate filePath: ' + normalizedFilePath,
      };
    }

    normalizedFilePaths.add(normalizedFilePath);
    files.push({
      filePath: value.filePath,
      sourceCode: value.sourceCode,
    });
  }

  return {
    success: true,
    value: {
      files,
    },
  };
}

function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
