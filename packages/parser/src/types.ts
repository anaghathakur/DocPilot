export type ExpressHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ExpressRoute {
  method: ExpressHttpMethod;
  path: string;
  middleware: string[];
  handler: string;
}

export interface ExtractExpressRoutesOptions {
  filePath?: string;
}

export interface ExpressProjectFile {
  filePath: string;
  sourceCode: string;
}

export interface ExpressProjectRoute extends ExpressRoute {
  filePath: string;
}

export type ExpressProjectFileErrorCode = 'INVALID_SOURCE_CODE';

export interface ExpressProjectFileError {
  filePath: string;
  code: ExpressProjectFileErrorCode;
  message: string;
}

export interface ExpressProjectAnalysisResult {
  routes: ExpressProjectRoute[];
  routeCount: number;
  filesAnalyzed: number;
  filesSkipped: string[];
  errors: ExpressProjectFileError[];
}
