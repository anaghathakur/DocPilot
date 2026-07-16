import { getNamedHandler, splitIdentifier } from './summaries.js';
import type { OpenApiRouteMethod } from './types.js';

const operationActionByMethod: Record<OpenApiRouteMethod, string> = {
  GET: 'get',
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

export function createOperationIdAllocator() {
  const usedOperationIds = new Set<string>();

  return (
    method: OpenApiRouteMethod,
    handler: string,
    convertedPath: string,
  ): string => {
    const namedHandler = getNamedHandler(handler);
    const base =
      sanitizeOperationId(namedHandler ?? '') ||
      createPathOperationId(method, convertedPath);
    let operationId = base;
    let suffix = 2;

    while (usedOperationIds.has(operationId)) {
      operationId = base + String(suffix);
      suffix += 1;
    }

    usedOperationIds.add(operationId);
    return operationId;
  };
}

function createPathOperationId(
  method: OpenApiRouteMethod,
  convertedPath: string,
): string {
  const words = convertedPath
    .split('/')
    .filter((segment) => segment.length > 0)
    .flatMap((segment) => {
      const parameterMatch = /^\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(segment);

      return parameterMatch === null
        ? splitIdentifier(segment)
        : ['by', ...splitIdentifier(parameterMatch[1]!)];
    });

  return toCamelIdentifier([operationActionByMethod[method], ...words]);
}

function sanitizeOperationId(value: string): string {
  const words = splitIdentifier(value);

  return words.length === 0 ? '' : toCamelIdentifier(words);
}

function toCamelIdentifier(words: string[]): string {
  const safeWords = words
    .map((word) => word.replace(/[^A-Za-z0-9]/g, ''))
    .filter((word) => word.length > 0);

  if (safeWords.length === 0) {
    return 'operation';
  }

  return (
    safeWords[0]!.toLowerCase() +
    safeWords
      .slice(1)
      .map((word) => word[0]!.toUpperCase() + word.slice(1).toLowerCase())
      .join('')
  );
}
