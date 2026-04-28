import { describe, expect, it } from 'vitest';
import { suggest, COMMAND_PATHS } from '../../src/errors/suggestions.js';

describe('suggest', () => {
  it('returns undefined for an exact match', () => {
    expect(suggest('task list', COMMAND_PATHS)).toBeUndefined();
  });
  it('returns a suggestion for a close typo', () => {
    expect(suggest('taks list', COMMAND_PATHS)).toBe('task list');
  });
  it('returns a suggestion for single-char typo', () => {
    expect(suggest('whoam', COMMAND_PATHS)).toBe('whoami');
  });
  it('returns undefined when input is too far from any command', () => {
    expect(suggest('xyzabc', COMMAND_PATHS)).toBeUndefined();
  });
  it('is case-insensitive', () => {
    expect(suggest('TASK LIST', COMMAND_PATHS)).toBe('task list');
  });
});
