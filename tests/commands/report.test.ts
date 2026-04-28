import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveProfile } from '../../src/config/profile.js';
import { runReportTodo, runReportOverdue, runReportAssignee } from '../../src/commands/report.js';

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

describe('report todo', () => {
  it('lists To Do tasks for a project as JSON', async () => {
    agent.get('http://api.test')
      .intercept({ path: /\/api\/tasks\?.*project=RVV.*status=To\+Do/, method: 'GET' })
      .reply(200, { data: [{ id: 1, title: 'A', status: 'To Do', priority: 'High' }] });

    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await runReportTodo({ profile: 'default', json: true, project: 'RVV', assignee: undefined });
    expect(spy.mock.calls.flat().join('')).toContain('"id": 1');
    spy.mockRestore();
  });

  it('throws when --project is missing', async () => {
    await expect(runReportTodo({ profile: 'default', json: false, project: undefined, assignee: undefined }))
      .rejects.toThrow('--project is required');
  });
});

describe('report overdue', () => {
  it('filters out tasks with due_date in the future', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]!;
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]!;
    agent.get('http://api.test')
      .intercept({ path: /\/api\/tasks\?.*assignee=all.*limit=200/, method: 'GET' })
      .reply(200, {
        data: [
          { id: 1, title: 'Overdue', status: 'In Progress', due_date: yesterday },
          { id: 2, title: 'Future', status: 'To Do', due_date: tomorrow },
          { id: 3, title: 'No due', status: 'To Do', due_date: null },
        ],
      });

    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await runReportOverdue({ profile: 'default', json: true, project: undefined, assignee: undefined });
    const out = spy.mock.calls.flat().join('');
    expect(out).toContain('"id": 1');
    expect(out).not.toContain('"id": 2');
    expect(out).not.toContain('"id": 3');
    spy.mockRestore();
  });
});

describe('report assignee', () => {
  it('groups tasks by assignee email', async () => {
    agent.get('http://api.test')
      .intercept({ path: /\/api\/tasks\?.*assignee=all.*limit=200/, method: 'GET' })
      .reply(200, {
        data: [
          { id: 1, status: 'In Progress', assignee: { id: 1, email: 'a@b', name: 'A' } },
          { id: 2, status: 'To Do',       assignee: { id: 1, email: 'a@b', name: 'A' } },
          { id: 3, status: 'In Progress', assignee: { id: 2, email: 'c@d', name: 'C' } },
        ],
      });

    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await runReportAssignee({ profile: 'default', json: true, project: undefined });
    const out = JSON.parse(spy.mock.calls.flat().join('').trim());
    const aRow = out.find((r: { assignee: { email: string } }) => r.assignee.email === 'a@b');
    expect(aRow.total).toBe(2);
    spy.mockRestore();
  });
});
