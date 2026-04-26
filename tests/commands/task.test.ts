import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveProfile } from '../../src/config/profile.js';
import { runTaskList, runTaskShow, runTaskUpdate } from '../../src/commands/task.js';

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

describe('task list', () => {
  it('defaults assignee=me, prints JSON', async () => {
    agent.get('http://api.test')
      .intercept({ path: '/api/tasks?assignee=me', method: 'GET' })
      .reply(200, { data: [{ id: 1, title: 'T1', status: 'In Progress' }] });
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await runTaskList({ profile: 'default', json: true, assignee: 'me', project: undefined, status: undefined, limit: undefined });
    expect(spy.mock.calls.flat().join('')).toContain('"id": 1');
    spy.mockRestore();
  });
});

describe('task show', () => {
  it('fetches one task', async () => {
    agent.get('http://api.test')
      .intercept({ path: '/api/tasks/42', method: 'GET' })
      .reply(200, { data: { id: 42, title: 'X', status: 'To Do' } });
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await runTaskShow({ profile: 'default', json: true, id: 42 });
    expect(spy.mock.calls.flat().join('')).toContain('"id": 42');
    spy.mockRestore();
  });
});

describe('task update', () => {
  it('PATCHes status', async () => {
    agent.get('http://api.test')
      .intercept({ path: '/api/tasks/9', method: 'PATCH' })
      .reply(200, { data: { id: 9, title: 'X', status: 'Done' } });
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await runTaskUpdate({ profile: 'default', json: true, id: 9, status: 'Done' });
    expect(spy.mock.calls.flat().join('')).toContain('"status": "Done"');
    spy.mockRestore();
  });
});
