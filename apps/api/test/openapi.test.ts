import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

const app = createApp();
const validRoute = {
  method: 'GET',
  path: '/users/:id',
  middleware: ['authMiddleware'],
  handler: 'getUserById',
  filePath: 'routes/users.ts',
};

describe('POST /generate/openapi', () => {
  it('generates JSON, YAML, parameters, extensions, and an optional server', async () => {
    const response = await request(app)
      .post('/generate/openapi')
      .send({
        routes: [validRoute],
        title: ' My API ',
        version: ' 2.0.0 ',
        serverUrl: ' https://api.example.com ',
      });

    expect(response.status).toBe(200);
    expect(response.body.document).toMatchObject({
      openapi: '3.1.0',
      info: {
        title: 'My API',
        version: '2.0.0',
      },
      servers: [{ url: 'https://api.example.com' }],
      paths: {
        '/users/{id}': {
          get: {
            summary: 'Get user by id',
            operationId: 'getUserById',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
            ],
            responses: {
              '200': { description: 'Successful response' },
            },
            'x-docpilot-handler': 'getUserById',
            'x-docpilot-middleware': ['authMiddleware'],
            'x-docpilot-file': 'routes/users.ts',
          },
        },
      },
    });
    expect(JSON.parse(response.body.json)).toEqual(response.body.document);
    expect(response.body.json.endsWith('\n')).toBe(true);
    expect(response.body.yaml.endsWith('\n')).toBe(true);
    expect(response.body.warnings).toEqual([]);
  });

  it('uses defaults for empty optional metadata', async () => {
    const response = await request(app)
      .post('/generate/openapi')
      .send({
        routes: [validRoute],
        title: ' ',
        version: '',
        serverUrl: ' ',
      });

    expect(response.status).toBe(200);
    expect(response.body.document.info).toEqual({
      title: 'DocPilot Generated API',
      version: '1.0.0',
    });
    expect(response.body.document).not.toHaveProperty('servers');
  });

  it('returns distinct duplicate and unsupported-path warnings', async () => {
    const response = await request(app)
      .post('/generate/openapi')
      .send({
        routes: [
          validRoute,
          { ...validRoute, path: '/users/{id}', handler: 'duplicateHandler' },
          { ...validRoute, path: '/files/*', handler: 'wildcardHandler' },
          { ...validRoute, path: '/health', handler: 'getHealth' },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.document.paths).toHaveProperty('/users/{id}');
    expect(response.body.document.paths).toHaveProperty('/health');
    expect(response.body.document.paths).not.toHaveProperty('/files/*');
    expect(response.body.warnings).toEqual([
      expect.objectContaining({
        code: 'DUPLICATE_OPERATION',
        keptRouteIndex: 0,
        ignoredRouteIndex: 1,
      }),
      expect.objectContaining({
        code: 'UNSUPPORTED_PATH',
        routeIndex: 2,
        path: '/files/*',
      }),
    ]);
  });

  it.each([
    ['missing routes', {}, 'routes must be a non-empty array'],
    ['empty routes', { routes: [] }, 'routes must be a non-empty array'],
    [
      'unsupported method',
      { routes: [{ ...validRoute, method: 'OPTIONS' }] },
      'routes[0].method must be GET, POST, PUT, PATCH, or DELETE',
    ],
    [
      'malformed path',
      { routes: [{ ...validRoute, path: 'users' }] },
      'routes[0].path must be a valid non-empty path beginning with /',
    ],
    [
      'missing middleware',
      { routes: [{ ...validRoute, middleware: undefined }] },
      'routes[0].middleware must be an array of strings',
    ],
    [
      'invalid handler',
      { routes: [{ ...validRoute, handler: 42 }] },
      'routes[0].handler must be a string',
    ],
    [
      'invalid title',
      { routes: [validRoute], title: 42 },
      'title must be a string when provided',
    ],
    [
      'invalid version',
      { routes: [validRoute], version: {} },
      'version must be a string when provided',
    ],
    [
      'invalid server URL',
      { routes: [validRoute], serverUrl: 'file:///tmp/api' },
      'serverUrl must be a valid HTTP or HTTPS URL',
    ],
  ])('rejects %s with clean JSON', async (_name, body, message) => {
    const response = await request(app).post('/generate/openapi').send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_REQUEST',
        message,
      },
    });
    expect(response.body.error).not.toHaveProperty('stack');
  });

  it('rejects more than 500 routes', async () => {
    const routes = Array.from({ length: 501 }, (_value, index) => ({
      ...validRoute,
      path: '/route-' + String(index),
    }));
    const response = await request(app)
      .post('/generate/openapi')
      .send({ routes });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_REQUEST',
        message: 'routes must contain no more than 500 items',
      },
    });
  });

  it('preserves clean malformed-JSON handling', async () => {
    const response = await request(app)
      .post('/generate/openapi')
      .set('Content-Type', 'application/json')
      .send('{"routes":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Request body must contain valid JSON',
      },
    });
  });
});
