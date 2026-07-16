import type {
  OpenApiPathParameter,
  OpenApiRouteMethod,
  UnsupportedPathWarning,
} from './types.js';

const expressParameter = /^:([A-Za-z_][A-Za-z0-9_]*)$/;
const openApiParameter = /^\{([A-Za-z_][A-Za-z0-9_]*)\}$/;
const unsupportedSyntax = /[*?+()[\]]/;

export type PathConversionResult =
  | {
      success: true;
      path: string;
      parameters: OpenApiPathParameter[];
      staticSegments: string[];
    }
  | {
      success: false;
      warning: UnsupportedPathWarning;
    };

export function convertRoutePath(
  path: string,
  method: OpenApiRouteMethod,
  routeIndex: number,
): PathConversionResult {
  const segments = path === '/' ? [''] : path.split('/');
  const convertedSegments: string[] = [''];
  const staticSegments: string[] = [];
  const parameterNames: string[] = [];
  const knownParameters = new Set<string>();

  for (const segment of segments.slice(1)) {
    const expressMatch = expressParameter.exec(segment);
    const openApiMatch = openApiParameter.exec(segment);
    const parameterName = expressMatch?.[1] ?? openApiMatch?.[1];

    if (parameterName !== undefined) {
      if (parameterName.length === 0) {
        return unsupportedPath(path, method, routeIndex);
      }

      convertedSegments.push('{' + parameterName + '}');

      if (!knownParameters.has(parameterName)) {
        knownParameters.add(parameterName);
        parameterNames.push(parameterName);
      }

      continue;
    }

    if (
      segment.length === 0 ||
      segment.includes(':') ||
      segment.includes('{') ||
      segment.includes('}') ||
      unsupportedSyntax.test(segment)
    ) {
      return unsupportedPath(path, method, routeIndex);
    }

    convertedSegments.push(segment);
    staticSegments.push(segment);
  }

  return {
    success: true,
    path: convertedSegments.join('/') || '/',
    parameters: parameterNames.map((name) => ({
      name,
      in: 'path',
      required: true,
      schema: {
        type: 'string',
      },
    })),
    staticSegments,
  };
}

function unsupportedPath(
  path: string,
  method: OpenApiRouteMethod,
  routeIndex: number,
): PathConversionResult {
  return {
    success: false,
    warning: {
      code: 'UNSUPPORTED_PATH',
      method,
      path,
      routeIndex,
      message:
        method +
        ' ' +
        path +
        ' uses Express path syntax that cannot be represented safely in this OpenAPI generator.',
    },
  };
}
