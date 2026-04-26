import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveProfile } from '../../src/config/profile.js';
import { runUserList } from '../../src/commands/user.js';

let agent: MockAgent;
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'revvork-'));
  process.env.REVVORK_CONFIG_DIR = dir;
  agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  saveProfile('default', { baseUrl: 'http://api.test', token: 'tok', email: 'a@b' });
});
afterEach(async () => {
  await agent.close();
  rmSync(dir, { recursive: true, force: true });
  delete process.env.REVVORK_CONFIG_DIR;
});

describe('user list', () => {
  it('prints user list as JSON', async () => {
    agent.get('http://api.test')
      .intercept({ path: '/api/users', method: 'GET' })
      .reply(200, { data: [{ id: 1, name: 'A', email: 'a@b', role: 'admin' }] });
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await runUserList({ profile: 'default', json: true });
    expect(spy.mock.calls.flat().join('')).toContain('a@b');
    spy.mockRestore();
  });
});
