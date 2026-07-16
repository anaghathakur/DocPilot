import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

import {
  defaultOpenApiTitle,
  defaultOpenApiVersion,
  generateOpenApi,
  OpenApiGenerationError,
  type OpenApiRouteInput,
} from '../src/index.js';

describe('generateOpenApi', () => {
  it('generates OpenAPI 3.1 with Express and existing path parameters in order', () => {
    const result = generateOpenApi({
      routes: [
        route({
          path: '/teams/:teamId/users/:userId',
          handler: 'getUserById',
        }),
        route({
          path: '/accounts/{accountId}/members/{memberId}/{accountId}',
          handler: 'getMember',
        }),
      ],
    });

    expect(result.document.openapi).toBe('3.1.0');
    expect(result.document.info).toEqual({
      title: defaultOpenApiTitle,
      version: defaultOpenApiVersion,
    });
    expect(result.document.paths).toHaveProperty(
      '/teams/{teamId}/users/{userId}',
    );
    expect(
      result.document.paths['/teams/{teamId}/users/{userId}']?.get?.parameters,
    ).toEqual([pathParameter('teamId'), pathParameter('userId')]);
    expect(
      result.document.paths[
        '/accounts/{accountId}/members/{memberId}/{accountId}'
      ]?.get?.parameters,
    ).toEqual([pathParameter('accountId'), pathParameter('memberId')]);
  });

  it('supports every route method with only the requested OpenAPI fields', () => {
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
    const result = generateOpenApi({
      routes: methods.map((method) =>
        route({
          method,
          path: '/' + method.toLowerCase(),
          handler: method.toLowerCase() + 'Handler',
        }),
      ),
    });

    expect(Object.keys(result.document.paths)).toEqual([
      '/get',
      '/post',
      '/put',
      '/patch',
      '/delete',
    ]);

    for (const method of methods) {
      const operation =
        result.document.paths['/' + method.toLowerCase()]?.[
          method.toLowerCase() as Lowercase<typeof method>
        ];

      expect(operation).toMatchObject({
        responses: {
          '200': {
            description: 'Successful response',
          },
        },
      });
      expect(operation).not.toHaveProperty('requestBody');
      expect(operation).not.toHaveProperty('tags');
      expect(operation).not.toHaveProperty('security');
      expect(operation).not.toHaveProperty('description');
    }
  });

  it('creates readable named summaries and safe generic inline summaries', () => {
    const inlineHandler = '(request, response) => response.json({ ok: true })';
    const result = generateOpenApi({
      routes: [
        route({ path: '/users/:id', handler: 'getUserById' }),
        route({
          method: 'POST',
          path: '/products',
          handler: 'productController.createProduct',
        }),
        route({
          method: 'GET',
          path: '/users',
          handler: inlineHandler,
        }),
        route({
          method: 'DELETE',
          path: '/items/:itemId',
          handler: 'function (request, response) {}',
        }),
      ],
    });

    expect(result.document.paths['/users/{id}']?.get?.summary).toBe(
      'Get user by id',
    );
    expect(result.document.paths['/products']?.post?.summary).toBe(
      'Create product',
    );
    expect(result.document.paths['/users']?.get?.summary).toBe('Get users');
    expect(result.document.paths['/items/{itemId}']?.delete?.summary).toBe(
      'Delete items',
    );
    expect(result.document.paths['/users']?.get?.['x-docpilot-handler']).toBe(
      inlineHandler,
    );
  });

  it('creates deterministic unique operation IDs without duplicate consumption', () => {
    const input = {
      routes: [
        route({ path: '/users', handler: 'getUserById' }),
        route({ path: '/users', handler: 'getUserById' }),
        route({
          method: 'POST' as const,
          path: '/members',
          handler: 'getUserById',
        }),
        route({
          method: 'GET' as const,
          path: '/inline/:id',
          handler: '(request) => request.params.id',
        }),
      ],
    };

    const first = generateOpenApi(input);
    const second = generateOpenApi(input);

    expect(first.document.paths['/users']?.get?.operationId).toBe(
      'getUserById',
    );
    expect(first.document.paths['/members']?.post?.operationId).toBe(
      'getUserById2',
    );
    expect(first.document.paths['/inline/{id}']?.get?.operationId).toBe(
      'getInlineById',
    );
    const operationIds = Object.values(first.document.paths)
      .flatMap((pathItem) => Object.values(pathItem))
      .map((operation) => operation.operationId);

    expect(operationIds).toHaveLength(new Set(operationIds).size);
    expect(operationIds.every((id) => /^[A-Za-z][A-Za-z0-9]*$/.test(id))).toBe(
      true,
    );
    expect(first).toEqual(second);
  });

  it('adds middleware, handler, file, and optional server extensions', () => {
    const result = generateOpenApi({
      title: ' My API ',
      version: ' 2.0.0 ',
      serverUrl: ' https://api.example.com/v1 ',
      routes: [
        route({
          method: 'PATCH',
          path: '/users/:id',
          handler: 'updateUser',
          middleware: ['authMiddleware', 'validateUser'],
          filePath: 'routes/users.ts',
        }),
      ],
    });

    expect(result.document.info).toEqual({
      title: 'My API',
      version: '2.0.0',
    });
    expect(result.document.servers).toEqual([
      { url: 'https://api.example.com/v1' },
    ]);
    expect(result.document.paths['/users/{id}']?.patch).toMatchObject({
      'x-docpilot-handler': 'updateUser',
      'x-docpilot-middleware': ['authMiddleware', 'validateUser'],
      'x-docpilot-file': 'routes/users.ts',
    });
  });

  it('keeps the first duplicate and returns stable structured warnings', () => {
    const result = generateOpenApi({
      routes: [
        route({ path: '/users/:id', handler: 'firstHandler' }),
        route({ path: '/users/{id}', handler: 'secondHandler' }),
        route({
          method: 'POST',
          path: '/users/{id}',
          handler: 'postHandler',
        }),
      ],
    });

    expect(
      result.document.paths['/users/{id}']?.get?.['x-docpilot-handler'],
    ).toBe('firstHandler');
    expect(result.document.paths['/users/{id}']?.post).toBeDefined();
    expect(result.warnings).toEqual([
      {
        code: 'DUPLICATE_OPERATION',
        method: 'GET',
        path: '/users/{id}',
        keptRouteIndex: 0,
        ignoredRouteIndex: 1,
        message:
          'GET /users/{id} duplicates an earlier operation and was ignored.',
      },
    ]);
  });

  it.each([
    '/files/*',
    '/users/:id?',
    '/users/:id+',
    '/users/:id(\\d+)',
    '/users/{}',
  ])('ignores unsupported path syntax with a warning: %s', (path) => {
    const result = generateOpenApi({
      routes: [
        route({ path, handler: 'unsupportedHandler' }),
        route({ path: '/valid', handler: 'validHandler' }),
      ],
    });

    expect(result.document.paths).toEqual({
      '/valid': expect.any(Object),
    });
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'UNSUPPORTED_PATH',
        method: 'GET',
        path,
        routeIndex: 0,
      }),
    ]);
  });

  it('serializes identical deterministic JSON and YAML with final newlines and no aliases', () => {
    const result = generateOpenApi({
      routes: [
        route({
          path: '/users/:id',
          handler: 'getUser',
          middleware: ['auth'],
        }),
      ],
    });

    expect(result.json.endsWith('\n')).toBe(true);
    expect(result.yaml.endsWith('\n')).toBe(true);
    expect(JSON.parse(result.json)).toEqual(result.document);
    expect(parse(result.yaml)).toEqual(result.document);
    expect(result.yaml).not.toMatch(/[&*][A-Za-z0-9_-]+/);
    expect(result.json).not.toContain('undefined');
    expect(result.yaml).not.toContain('undefined');
  });

  it('uses defaults for empty optional metadata and supports the root path', () => {
    const result = generateOpenApi({
      title: ' ',
      version: '',
      serverUrl: ' ',
      routes: [route({ path: '/', handler: 'getRoot' })],
    });

    expect(result.document.info).toEqual({
      title: defaultOpenApiTitle,
      version: defaultOpenApiVersion,
    });
    expect(result.document).not.toHaveProperty('servers');
    expect(result.document.paths['/']?.get).toBeDefined();
  });

  it('rejects invalid generator input defensively', () => {
    expect(() => generateOpenApi({ routes: [] })).toThrowError(
      OpenApiGenerationError,
    );
    expect(() =>
      generateOpenApi({
        routes: [route({ method: 'OPTIONS' as 'GET' })],
      }),
    ).toThrow('method is unsupported');
    expect(() =>
      generateOpenApi({
        routes: [route({ path: 'users' })],
      }),
    ).toThrow('path must start with /');
    expect(() =>
      generateOpenApi({
        serverUrl: 'file:///tmp/api',
        routes: [route()],
      }),
    ).toThrow('valid HTTP or HTTPS URL');
  });
});

function route(overrides: Partial<OpenApiRouteInput> = {}): OpenApiRouteInput {
  return {
    method: 'GET',
    path: '/users',
    middleware: [],
    handler: 'getUsers',
    ...overrides,
  };
}

function pathParameter(name: string) {
  return {
    name,
    in: 'path',
    required: true,
    schema: {
      type: 'string',
    },
  };
}
