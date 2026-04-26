import { describe, expect, it } from 'vitest';
import { ApiError, exitCodeFor } from '../../src/api/errors.js';

describe('ApiError', () => {
  it('maps 401 → exit 2', () => {
    expect(exitCodeFor(new ApiError(401, 'Unauthenticated'))).toBe(2);
  });
  it('maps 403/422 → exit 3', () => {
    expect(exitCodeFor(new ApiError(403, 'Forbidden'))).toBe(3);
    expect(exitCodeFor(new ApiError(422, 'Validation', { email: ['required'] }))).toBe(3);
  });
  it('maps 404 → exit 4', () => {
    expect(exitCodeFor(new ApiError(404, 'Not found'))).toBe(4);
  });
  it('maps 500 → exit 5', () => {
    expect(exitCodeFor(new ApiError(500, 'Server'))).toBe(5);
  });
  it('maps generic Error → exit 1', () => {
    expect(exitCodeFor(new Error('x'))).toBe(1);
  });
});
