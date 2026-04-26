export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function exitCodeFor(err: unknown): number {
  if (err instanceof ApiError) {
    if (err.status === 401) return 2;
    if (err.status === 404) return 4;
    if (err.status >= 500) return 5;
    if (err.status >= 400) return 3;
  }
  return 1;
}
