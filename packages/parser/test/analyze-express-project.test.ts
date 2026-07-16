import { describe, expect, it } from 'vitest';

import { analyzeExpressProject } from '../src/index.js';

describe('analyzeExpressProject', () => {
  it('combines routes from multiple JavaScript and TypeScript files in source order', () => {
    const result = analyzeExpressProject([
      {
        filePath: 'routes/users.ts',
        sourceCode: [
          "router.get('/users', authMiddleware, getUsers);",
          "router.post('/users', validateUser, createUser);",
        ].join('\n'),
      },
      {
        filePath: 'routes/products.js',
        sourceCode: "router.post('/products', validateProduct, createProduct);",
      },
    ]);

    expect(result).toEqual({
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
      filesSkipped: [],
      errors: [],
    });
  });

  it.each(['js', 'jsx', 'ts', 'tsx'])(
    'analyzes virtual .%s source files',
    (extension) => {
      const result = analyzeExpressProject([
        {
          filePath: 'routes/health.' + extension,
          sourceCode: "app.get('/health', healthHandler);",
        },
      ]);

      expect(result.routes).toEqual([
        {
          method: 'GET',
          path: '/health',
          middleware: [],
          handler: 'healthHandler',
          filePath: 'routes/health.' + extension,
        },
      ]);
      expect(result.filesAnalyzed).toBe(1);
    },
  );

  it('normalizes Windows separators without changing the rest of the path', () => {
    const result = analyzeExpressProject([
      {
        filePath: 'src\\Routes\\Users.TS',
        sourceCode: "router.get('/users', getUsers);",
      },
    ]);

    expect(result.routes[0]?.filePath).toBe('src/Routes/Users.TS');
    expect(result.filesSkipped).toEqual([]);
  });

  it('skips unsupported extensions without attempting to parse them', () => {
    const result = analyzeExpressProject([
      {
        filePath: 'routes\\notes.md',
        sourceCode: 'this is not valid JavaScript',
      },
      {
        filePath: 'routes/users.ts',
        sourceCode: "router.get('/users', getUsers);",
      },
    ]);

    expect(result.filesSkipped).toEqual(['routes/notes.md']);
    expect(result.filesAnalyzed).toBe(1);
    expect(result.errors).toEqual([]);
    expect(result.routeCount).toBe(1);
  });

  it('returns a file-level syntax error and continues analyzing valid files', () => {
    const result = analyzeExpressProject([
      {
        filePath: 'routes\\broken.ts',
        sourceCode: "router.get('/broken', brokenHandler;",
      },
      {
        filePath: 'routes/valid.ts',
        sourceCode: "router.get('/valid', validHandler);",
      },
    ]);

    expect(result.routes).toEqual([
      {
        method: 'GET',
        path: '/valid',
        middleware: [],
        handler: 'validHandler',
        filePath: 'routes/valid.ts',
      },
    ]);
    expect(result.routeCount).toBe(1);
    expect(result.filesAnalyzed).toBe(2);
    expect(result.filesSkipped).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      filePath: 'routes/broken.ts',
      code: 'INVALID_SOURCE_CODE',
      message: expect.stringContaining('Unable to parse source code'),
    });
    expect(result.errors[0]?.message).not.toContain('stack');
  });

  it('preserves duplicate input entries and duplicate routes', () => {
    const result = analyzeExpressProject([
      {
        filePath: 'routes/users.ts',
        sourceCode: "router.get('/users', getUsers);",
      },
      {
        filePath: 'routes/users.ts',
        sourceCode: "router.get('/users', getUsers);",
      },
    ]);

    expect(result.routes).toHaveLength(2);
    expect(result.routes[0]).toEqual(result.routes[1]);
    expect(result.routeCount).toBe(2);
    expect(result.filesAnalyzed).toBe(2);
  });
});
