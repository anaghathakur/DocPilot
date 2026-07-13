import cors from 'cors';
import express from 'express';
import type { ErrorRequestHandler } from 'express';

import { analyzeSource, sendError } from './analyze-source.js';

const defaultWebOrigin = 'http://localhost:3000';

export interface CreateAppOptions {
  webOrigin?: string;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const webOrigin = normalizeWebOrigin(
    options.webOrigin ?? process.env.WEB_ORIGIN,
  );

  app.use(
    cors({
      origin(requestOrigin, callback) {
        callback(
          null,
          requestOrigin === undefined || requestOrigin === webOrigin,
        );
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
    }),
  );
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

function normalizeWebOrigin(value: string | undefined): string {
  const origin = value?.trim().replace(/\/+$/, '');

  return origin || defaultWebOrigin;
}

function isMalformedJsonError(error: unknown): boolean {
  return (
    error instanceof SyntaxError && isRecord(error) && error.status === 400
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
