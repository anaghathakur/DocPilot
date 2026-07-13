export class ExpressRouteParserError extends Error {
  readonly filePath: string;

  constructor(message: string, filePath: string, options?: ErrorOptions) {
    super(message + ' (' + filePath + ')', options);
    this.name = 'ExpressRouteParserError';
    this.filePath = filePath;
  }
}
