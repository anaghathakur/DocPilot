import { describe, expect, it } from 'vitest';

import { ExpressRouteParserError, extractExpressRoutes } from '../src/index.js';

describe('extractExpressRoutes', () => {
  it.each([
    ['app', 'get', 'GET'],
    ['app', 'post', 'POST'],
    ['app', 'put', 'PUT'],
    ['app', 'patch', 'PATCH'],
    ['app', 'delete', 'DELETE'],
    ['router', 'get', 'GET'],
    ['router', 'post', 'POST'],
    ['router', 'put', 'PUT'],
    ['router', 'patch', 'PATCH'],
    ['router', 'delete', 'DELETE'],
  ] as const)('extracts %s.%s routes', (receiver, method, expectedMethod) => {
    const routes = extractExpressRoutes(
      receiver + '.' + method + "('/resource', routeHandler);",
    );

    expect(routes).toEqual([
      {
        method: expectedMethod,
        path: '/resource',
        middleware: [],
        handler: 'routeHandler',
      },
    ]);
  });

  it('supports JavaScript source files', () => {
    const routes = extractExpressRoutes('app.get("/health", healthHandler);', {
      filePath: 'routes.js',
    });

    expect(routes).toEqual([
      {
        method: 'GET',
        path: '/health',
        middleware: [],
        handler: 'healthHandler',
      },
    ]);
  });

  it('extracts middleware in source order and uses the final argument as the handler', () => {
    const routes = extractExpressRoutes(
      [
        'router.post(',
        '  "/users",',
        '  authenticate("admin"),',
        '  validateUser,',
        '  createUser,',
        ');',
      ].join('\n'),
    );

    expect(routes).toEqual([
      {
        method: 'POST',
        path: '/users',
        middleware: ['authenticate("admin")', 'validateUser'],
        handler: 'createUser',
      },
    ]);
  });

  it('extracts multiple routes from TypeScript source', () => {
    const routes = extractExpressRoutes(
      [
        'router.get("/users", authMiddleware, getUsers);',
        'router.post("/users", validateUser, createUser);',
      ].join('\n'),
      { filePath: 'routes.ts' },
    );

    expect(routes).toEqual([
      {
        method: 'GET',
        path: '/users',
        middleware: ['authMiddleware'],
        handler: 'getUsers',
      },
      {
        method: 'POST',
        path: '/users',
        middleware: ['validateUser'],
        handler: 'createUser',
      },
    ]);
  });

  it('ignores dynamic paths, template literals, unrelated receivers, and non-route getters', () => {
    const templateQuote = String.fromCharCode(96);
    const routes = extractExpressRoutes(
      [
        'const routePath = "/dynamic";',
        'router.get(routePath, dynamicHandler);',
        'router.get(' +
          templateQuote +
          '/template' +
          templateQuote +
          ', templateHandler);',
        'router.get(' +
          templateQuote +
          '/users/$' +
          '{userId}' +
          templateQuote +
          ', userHandler);',
        'service.get("/service", serviceHandler);',
        'app.get("env");',
        'app.get("/literal", literalHandler);',
      ].join('\n'),
    );

    expect(routes).toEqual([
      {
        method: 'GET',
        path: '/literal',
        middleware: [],
        handler: 'literalHandler',
      },
    ]);
  });

  it('throws a descriptive parser error for invalid source syntax', () => {
    expect(() =>
      extractExpressRoutes('router.get("/users", handler;', {
        filePath: 'broken-routes.ts',
      }),
    ).toThrowError(ExpressRouteParserError);

    expect(() =>
      extractExpressRoutes('router.get("/users", handler;', {
        filePath: 'broken-routes.ts',
      }),
    ).toThrow(/Unable to parse source code.*broken-routes\.ts/);
  });
});
