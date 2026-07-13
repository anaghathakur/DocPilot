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
