import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

const app = createApp();

describe('DocPilot API', () => {
  it('preserves the health endpoint', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      message: 'DocPilot API is running',
    });
  });

  it('extracts Express routes from source code', async () => {
    const response = await request(app).post('/analyze/source').send({
      sourceCode: "router.get('/users', authMiddleware, getUsers);",
      filename: 'routes.ts',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      routes: [
        {
          method: 'GET',
          path: '/users',
          middleware: ['authMiddleware'],
          handler: 'getUsers',
        },
      ],
      count: 1,
    });
  });

  it('returns an empty successful result when no supported routes exist', async () => {
    const response = await request(app).post('/analyze/source').send({
      sourceCode: 'const value = 42;',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      routes: [],
      count: 0,
    });
  });

  it.each([
    ['missing sourceCode', {}, 'sourceCode must be a non-empty string'],
    [
      'an empty sourceCode',
      { sourceCode: '' },
      'sourceCode must be a non-empty string',
    ],
    [
      'a whitespace-only sourceCode',
      { sourceCode: '   ' },
      'sourceCode must be a non-empty string',
    ],
    [
      'a non-string sourceCode',
      { sourceCode: 42 },
      'sourceCode must be a non-empty string',
    ],
    ['an array request body', [], 'sourceCode must be a non-empty string'],
    [
      'an empty filename',
      { sourceCode: 'app.get("/health", handler);', filename: '' },
      'filename must be a non-empty string when provided',
    ],
    [
      'a non-string filename',
      { sourceCode: 'app.get("/health", handler);', filename: 42 },
      'filename must be a non-empty string when provided',
    ],
  ])('returns HTTP 400 for %s', async (_description, body, message) => {
    const response = await request(app).post('/analyze/source').send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_REQUEST',
        message,
      },
    });
  });

  it('returns clean JSON for malformed request JSON', async () => {
    const response = await request(app)
      .post('/analyze/source')
      .set('Content-Type', 'application/json')
      .send('{"sourceCode":');

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Request body must contain valid JSON',
      },
    });
    expect(response.body.error).not.toHaveProperty('stack');
  });

  it('returns HTTP 422 for invalid source syntax and uses the default filename', async () => {
    const response = await request(app).post('/analyze/source').send({
      sourceCode: 'router.get("/users", handler;',
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INVALID_SOURCE_CODE');
    expect(response.body.error.message).toContain(
      'Unable to parse source code',
    );
    expect(response.body.error.message).toContain('routes.ts');
    expect(response.body.error).not.toHaveProperty('stack');
  });
});

describe('CORS', () => {
  const allowedOrigin = 'https://docpilot.example';
  const corsApp = createApp({
    webOrigin: allowedOrigin + '/',
  });

  it('allows the configured web origin', async () => {
    const response = await request(corsApp)
      .get('/health')
      .set('Origin', allowedOrigin);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(allowedOrigin);
  });

  it('allows requests without an Origin header', async () => {
    const response = await request(corsApp).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('does not grant CORS permission to another browser origin', async () => {
    const response = await request(corsApp)
      .get('/health')
      .set('Origin', 'https://untrusted.example');

    expect(response.status).toBe(200);
    expect(response.headers).not.toHaveProperty('access-control-allow-origin');
  });
});
