export class OpenApiGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenApiGenerationError';
  }
}
