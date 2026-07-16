import type { NextFunction, Request, Response } from 'express';

import { sendError } from './analyze-source.js';
import { GitHubAnalysisError } from './github-errors.js';
import type { GitHubRepositoryAnalyzer } from './github-repository-analyzer.js';

export function createAnalyzeGitHub(analyzer: GitHubRepositoryAnalyzer) {
  return (request: Request, response: Response, next: NextFunction): void => {
    void handleAnalyzeGitHub(request, response, next, analyzer);
  };
}

async function handleAnalyzeGitHub(
  request: Request,
  response: Response,
  next: NextFunction,
  analyzer: GitHubRepositoryAnalyzer,
): Promise<void> {
  if (
    !isRecord(request.body) ||
    typeof request.body.repositoryUrl !== 'string' ||
    request.body.repositoryUrl.trim().length === 0
  ) {
    sendError(
      response,
      400,
      'INVALID_REPOSITORY_URL',
      'repositoryUrl must be a non-empty GitHub repository URL',
    );
    return;
  }

  try {
    const result = await analyzer.analyze(request.body.repositoryUrl);
    response.status(200).json(result);
  } catch (error) {
    if (error instanceof GitHubAnalysisError) {
      sendError(
        response,
        error.status,
        error.code,
        error.message,
        error.rateLimitReset === undefined
          ? {}
          : { rateLimitReset: error.rateLimitReset },
      );
      return;
    }

    next(error);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
