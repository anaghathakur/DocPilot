import type { OpenApiRouteMethod } from './types.js';

const namedHandler =
  /^(?:[$A-Za-z_][$A-Za-z0-9_]*\.)*([$A-Za-z_][$A-Za-z0-9_]*)$/;

const actionByMethod: Record<OpenApiRouteMethod, string> = {
  GET: 'Get',
  POST: 'Create',
  PUT: 'Update',
  PATCH: 'Update',
  DELETE: 'Delete',
};

export function createOperationSummary(
  method: OpenApiRouteMethod,
  handler: string,
  staticSegments: string[],
): string {
  const handlerName = namedHandler.exec(handler.trim())?.[1];

  if (handlerName !== undefined) {
    const words = splitIdentifier(handlerName);

    if (words.length > 0) {
      return capitalize(words.join(' '));
    }
  }

  const resourceSegment = staticSegments.at(-1);
  const resourceWords =
    resourceSegment === undefined ? [] : splitIdentifier(resourceSegment);
  const resource =
    resourceWords.length > 0 ? resourceWords.join(' ') : 'resource';

  return actionByMethod[method] + ' ' + resource;
}

export function getNamedHandler(handler: string): string | undefined {
  return namedHandler.exec(handler.trim())?.[1];
}

export function splitIdentifier(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.toLowerCase());
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1);
}
