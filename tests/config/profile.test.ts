import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, saveProfile, getActiveProfile, setActiveProfile, clearProfileToken } from '../../src/config/profile.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'revvork-cli-'));
  process.env.REVVORK_CONFIG_DIR = dir;
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.REVVORK_CONFIG_DIR;
});

describe('profile config', () => {
  it('returns empty config when none exists', () => {
    expect(loadConfig()).toEqual({ currentProfile: 'default', profiles: {} });
  });

  it('saves and loads a profile', () => {
    saveProfile('default', { baseUrl: 'http://x', token: 't', email: 'a@b' });
    const cfg = loadConfig();
    expect(cfg.profiles.default).toEqual({ baseUrl: 'http://x', token: 't', email: 'a@b' });
  });

  it('switches active profile', () => {
    saveProfile('prod', { baseUrl: 'http://prod', token: 't2', email: 'b@b' });
    setActiveProfile('prod');
    expect(getActiveProfile()?.baseUrl).toBe('http://prod');
  });

  it('clears token without deleting profile', () => {
    saveProfile('default', { baseUrl: 'http://x', token: 't', email: 'a@b' });
    clearProfileToken('default');
    expect(loadConfig().profiles.default?.token).toBeUndefined();
  });
});
