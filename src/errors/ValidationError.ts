export class ValidationError extends Error {
  constructor(message: string, public hint?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
