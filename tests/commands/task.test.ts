import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveProfile } from '../../src/config/profile.js';
import { runTaskList, runTaskShow, runTaskUpdate, runTaskCreate, runTaskEdit, runTaskComment } from '../../src/commands/task.js';

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

describe('task create', () => {
  it('POSTs to /api/tasks and prints JSON', async () => {
    agent.get('http://api.test').intercept({ path: '/api/projects', method: 'GET' })
      .reply(200, { data: [{ id: 1, code: 'RVV', title: 'Revvork' }] });
    agent.get('http://api.test').intercept({ path: '/api/tasks', method: 'POST' })
      .reply(201, { data: { id: 10, title: 'New task', status: 'Backlog', priority: 'Medium' } });

    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await runTaskCreate({ profile: 'default', json: true, title: 'New task', project: 'RVV', assignee: undefined, priority: undefined, status: undefined, start: undefined, due: undefined });
    expect(spy.mock.calls.flat().join('')).toContain('"id": 10');
    spy.mockRestore();
  });

  it('throws ValidationError for invalid priority', async () => {
    const { ValidationError } = await import('../../src/errors/ValidationError.js');
    await expect(runTaskCreate({ profile: 'default', json: false, title: 'T', project: undefined, assignee: undefined, priority: 'Extreme', status: undefined, start: undefined, due: undefined }))
      .rejects.toBeInstanceOf(ValidationError);
  });
});

describe('task edit (update)', () => {
  it('PATCHes task with title', async () => {
    agent.get('http://api.test').intercept({ path: '/api/tasks/5', method: 'PATCH' })
      .reply(200, { data: { id: 5, title: 'Updated', status: 'To Do' } });

    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await runTaskEdit({ profile: 'default', json: true, id: 5, title: 'Updated', priority: undefined, assignee: undefined, project: undefined, start: undefined, due: undefined });
    expect(spy.mock.calls.flat().join('')).toContain('"id": 5');
    spy.mockRestore();
  });

  it('throws when no flags provided', async () => {
    await expect(runTaskEdit({ profile: 'default', json: false, id: 5, title: undefined, priority: undefined, assignee: undefined, project: undefined, start: undefined, due: undefined }))
      .rejects.toThrow('Nothing to update');
  });
});

describe('task comment', () => {
  it('POSTs comment and prints success', async () => {
    agent.get('http://api.test').intercept({ path: '/api/tasks/7/comments', method: 'POST' })
      .reply(201, { data: { id: 1, content: 'Nice work', user: { id: 1, email: 'a@b', name: 'A' }, created_at: '2026-04-28T00:00:00Z' } });

    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await runTaskComment({ profile: 'default', json: false, id: 7, content: 'Nice work' });
    expect(spy.mock.calls.flat().join('')).toContain('Comment added');
    spy.mockRestore();
  });
});
