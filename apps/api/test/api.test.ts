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
describe('POST /analyze/project', () => {
  it('combines JavaScript and TypeScript routes and reports skipped files', async () => {
    const response = await request(app)
      .post('/analyze/project')
      .send({
        files: [
          {
            filePath: 'routes\\users.ts',
            sourceCode: [
              "router.get('/users', authMiddleware, getUsers);",
              "router.post('/users', validateUser, createUser);",
            ].join('\n'),
          },
          {
            filePath: 'routes/products.js',
            sourceCode:
              "router.post('/products', validateProduct, createProduct);",
          },
          {
            filePath: 'notes/routes.md',
            sourceCode: "router.get('/ignored', ignoredHandler);",
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      routes: [
        {
          method: 'GET',
          path: '/users',
          middleware: ['authMiddleware'],
          handler: 'getUsers',
          filePath: 'routes/users.ts',
        },
        {
          method: 'POST',
          path: '/users',
          middleware: ['validateUser'],
          handler: 'createUser',
          filePath: 'routes/users.ts',
        },
        {
          method: 'POST',
          path: '/products',
          middleware: ['validateProduct'],
          handler: 'createProduct',
          filePath: 'routes/products.js',
        },
      ],
      routeCount: 3,
      filesAnalyzed: 2,
      filesSkipped: ['notes/routes.md'],
      errors: [],
    });
  });

  it('returns partial results when one supported file has invalid syntax', async () => {
    const response = await request(app)
      .post('/analyze/project')
      .send({
        files: [
          {
            filePath: 'routes\\broken.tsx',
            sourceCode: "router.get('/broken', brokenHandler;",
          },
          {
            filePath: 'routes/valid.jsx',
            sourceCode: "router.get('/valid', validHandler);",
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.routes).toEqual([
      {
        method: 'GET',
        path: '/valid',
        middleware: [],
        handler: 'validHandler',
        filePath: 'routes/valid.jsx',
      },
    ]);
    expect(response.body.routeCount).toBe(1);
    expect(response.body.filesAnalyzed).toBe(2);
    expect(response.body.filesSkipped).toEqual([]);
    expect(response.body.errors).toHaveLength(1);
    expect(response.body.errors[0]).toEqual({
      filePath: 'routes/broken.tsx',
      code: 'INVALID_SOURCE_CODE',
      message: expect.stringContaining('Unable to parse source code'),
    });
    expect(response.body.errors[0]).not.toHaveProperty('stack');
  });

  it('rejects duplicate paths after separator normalization', async () => {
    const response = await request(app)
      .post('/analyze/project')
      .send({
        files: [
          {
            filePath: 'routes\\users.ts',
            sourceCode: "router.get('/users', getUsers);",
          },
          {
            filePath: 'routes/users.ts',
            sourceCode: "router.post('/users', createUser);",
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_REQUEST',
        message: 'duplicate filePath: routes/users.ts',
      },
    });
  });

  it.each([
    ['a missing files property', {}, 'files must be a non-empty array'],
    [
      'a non-array files property',
      { files: {} },
      'files must be a non-empty array',
    ],
    ['an empty files array', { files: [] }, 'files must be a non-empty array'],
    [
      'a non-object file',
      { files: [null] },
      'files[0].filePath must be a non-empty string',
    ],
    [
      'an empty file path',
      { files: [{ filePath: ' ', sourceCode: 'const value = 1;' }] },
      'files[0].filePath must be a non-empty string',
    ],
    [
      'empty source code',
      { files: [{ filePath: 'routes.ts', sourceCode: ' ' }] },
      'files[0].sourceCode must be a non-empty string',
    ],
  ])('rejects %s', async (_description, body, message) => {
    const response = await request(app).post('/analyze/project').send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_REQUEST',
        message,
      },
    });
  });

  it('accepts exactly 100 files', async () => {
    const files = Array.from({ length: 100 }, (_value, index) => ({
      filePath: 'notes/file-' + String(index) + '.md',
      sourceCode: 'not parsed',
    }));

    const response = await request(app)
      .post('/analyze/project')
      .send({ files });

    expect(response.status).toBe(200);
    expect(response.body.routeCount).toBe(0);
    expect(response.body.filesAnalyzed).toBe(0);
    expect(response.body.filesSkipped).toHaveLength(100);
    expect(response.body.errors).toEqual([]);
  });

  it('rejects requests containing more than 100 files', async () => {
    const files = Array.from({ length: 101 }, (_value, index) => ({
      filePath: 'routes/file-' + String(index) + '.ts',
      sourceCode: "router.get('/route', handler);",
    }));

    const response = await request(app)
      .post('/analyze/project')
      .send({ files });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_REQUEST',
        message: 'files must contain no more than 100 items',
      },
    });
  });

  it('returns clean JSON for malformed request JSON', async () => {
    const response = await request(app)
      .post('/analyze/project')
      .set('Content-Type', 'application/json')
      .send('{"files":');

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
});
