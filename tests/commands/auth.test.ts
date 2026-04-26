import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runLogin } from '../../src/commands/login.js';
import { runLogout } from '../../src/commands/logout.js';
import { runWhoami } from '../../src/commands/whoami.js';
import { loadConfig } from '../../src/config/profile.js';

let agent: MockAgent;
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'revvork-'));
  process.env.REVVORK_CONFIG_DIR = dir;
  agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
});
afterEach(async () => {
  await agent.close();
  rmSync(dir, { recursive: true, force: true });
  delete process.env.REVVORK_CONFIG_DIR;
});

describe('login --token', () => {
  it('validates token via /auth/me and stores it', async () => {
    agent.get('http://api.test').intercept({ path: '/api/auth/me', method: 'GET' })
      .reply(200, { id: 1, email: 'a@b', name: 'A', role: 'admin' });

    await runLogin({ baseUrl: 'http://api.test', profile: 'default', token: 'abc', json: false });

    expect(loadConfig().profiles['default']?.token).toBe('abc');
    expect(loadConfig().profiles['default']?.email).toBe('a@b');
  });
});

describe('whoami', () => {
  it('prints current user', async () => {
    agent.get('http://api.test').intercept({ path: '/api/auth/me', method: 'GET' })
      .reply(200, { id: 1, email: 'a@b', name: 'A', role: 'admin' });
    await runLogin({ baseUrl: 'http://api.test', profile: 'default', token: 'abc', json: false });

    agent.get('http://api.test').intercept({ path: '/api/auth/me', method: 'GET' })
      .reply(200, { id: 1, email: 'a@b', name: 'A', role: 'admin' });

    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await runWhoami({ profile: 'default', json: true });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('logout', () => {
  it('calls API and clears token', async () => {
    agent.get('http://api.test').intercept({ path: '/api/auth/me', method: 'GET' })
      .reply(200, { id: 1, email: 'a@b', name: 'A', role: 'admin' });
    await runLogin({ baseUrl: 'http://api.test', profile: 'default', token: 'abc', json: false });

    agent.get('http://api.test').intercept({ path: '/api/auth/logout', method: 'POST' })
      .reply(200, { ok: true });

    await runLogout({ profile: 'default', json: false });
    expect(loadConfig().profiles['default']?.token).toBeUndefined();
  });
});
