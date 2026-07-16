import { ExpressRouteParserError } from './errors.js';
import { extractExpressRoutes } from './extract-express-routes.js';
import type {
  ExpressProjectAnalysisResult,
  ExpressProjectFile,
} from './types.js';

const supportedFileExtension = /\.(?:js|jsx|ts|tsx)$/i;

export function analyzeExpressProject(
  files: readonly ExpressProjectFile[],
): ExpressProjectAnalysisResult {
  const result: ExpressProjectAnalysisResult = {
    routes: [],
    routeCount: 0,
    filesAnalyzed: 0,
    filesSkipped: [],
    errors: [],
  };

  for (const file of files) {
    const filePath = normalizeFilePath(file.filePath);

    if (!supportedFileExtension.test(filePath)) {
      result.filesSkipped.push(filePath);
      continue;
    }

    result.filesAnalyzed += 1;

    try {
      const routes = extractExpressRoutes(file.sourceCode, { filePath });

      result.routes.push(
        ...routes.map((route) => ({
          ...route,
          filePath,
        })),
      );
    } catch (error) {
      if (error instanceof ExpressRouteParserError) {
        result.errors.push({
          filePath,
          code: 'INVALID_SOURCE_CODE',
          message: error.message,
        });
        continue;
      }

      throw error;
    }
  }

  result.routeCount = result.routes.length;

  return result;
}

function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}
