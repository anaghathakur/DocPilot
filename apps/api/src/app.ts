import express from 'express';
import type { ErrorRequestHandler } from 'express';

import { analyzeSource, sendError } from './analyze-source.js';

export function createApp() {
  const app = express();

  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.status(200).json({
      status: 'ok',
      message: 'DocPilot API is running',
    });
  });

  app.post('/analyze/source', analyzeSource);

  const errorHandler: ErrorRequestHandler = (
    error,
    _request,
    response,
    next,
  ) => {
    void next;
    if (isMalformedJsonError(error)) {
      sendError(
        response,
        400,
        'INVALID_REQUEST',
        'Request body must contain valid JSON',
      );
      return;
    }

    sendError(response, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  };

  app.use(errorHandler);

  return app;
}

function isMalformedJsonError(error: unknown): boolean {
  return (
    error instanceof SyntaxError && isRecord(error) && error.status === 400
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
