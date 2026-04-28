import { ApiClient } from '../api/client.js';
import { ApiError } from '../api/errors.js';
import { CommentSchema, ItemEnvelope, ListEnvelope, TaskSchema } from '../api/schemas.js';
import { resolveProjectId, resolveAssigneeId } from '../api/resolve.js';
import { ValidationError } from '../errors/ValidationError.js';
import { getActiveProfile } from '../config/profile.js';
import { printTable, success } from '../output/table.js';
import { printJson } from '../output/json.js';

function clientFor(profile: string): ApiClient {
  const p = getActiveProfile(profile);
  if (!p?.token) throw new ApiError(401, 'Not logged in. Run: revvork login');
  return new ApiClient({ baseUrl: p.baseUrl, token: p.token });
}

export type TaskListOpts = {
  profile: string; json: boolean;
  assignee?: string; project?: string; status?: string; limit?: string;
};

export async function runTaskList(opts: TaskListOpts): Promise<void> {
  const client = clientFor(opts.profile);
  const raw = await client.get('/api/tasks', {
    assignee: opts.assignee ?? 'me',
    project: opts.project,
    status: opts.status,
    limit: opts.limit,
  });
  const { data } = ListEnvelope(TaskSchema).parse(raw);

  if (opts.json) { printJson(data); return; }
  if (data.length === 0) { process.stdout.write('No tasks.\n'); return; }
  printTable(
    ['ID', 'Title', 'Status', 'Priority', 'Assignee', 'Project', 'Due'],
    data.map((t) => [
      t.id, t.title ?? null, t.status ?? null, t.priority ?? null,
      t.assignee?.email ?? null, t.project?.code ?? null, t.due_date ?? null,
    ]),
  );
}

export type TaskShowOpts = { profile: string; json: boolean; id: number };

export async function runTaskShow(opts: TaskShowOpts): Promise<void> {
  const client = clientFor(opts.profile);
  const raw = await client.get(`/api/tasks/${opts.id}`);
  const { data: t } = ItemEnvelope(TaskSchema).parse(raw);
  if (opts.json) { printJson(t); return; }
  printTable(
    ['Field', 'Value'],
    [
      ['ID', t.id], ['Title', t.title ?? null], ['Status', t.status ?? null],
      ['Priority', t.priority ?? null], ['Assignee', t.assignee?.email ?? null],
      ['Project', t.project?.code ?? null], ['Start', t.start_date ?? null],
      ['Due', t.due_date ?? null], ['Last activity', t.last_activity_at ?? null],
    ],
  );
}

export type TaskUpdateOpts = { profile: string; json: boolean; id: number; status?: string };

export async function runTaskUpdate(opts: TaskUpdateOpts): Promise<void> {
  const client = clientFor(opts.profile);
  const body: Record<string, unknown> = {};
  if (opts.status) body.status = opts.status;
  if (Object.keys(body).length === 0) {
    process.stderr.write('Nothing to update.\n');
    return;
  }
  const raw = await client.patch(`/api/tasks/${opts.id}`, body);
  const { data: t } = ItemEnvelope(TaskSchema).parse(raw);
  if (opts.json) { printJson(t); return; }
  success(`Task #${t.id} updated → status: ${t.status ?? '—'}`);
}

const VALID_PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'];

export type TaskCreateOpts = {
  profile: string; json: boolean; title: string;
  project?: string; assignee?: string; priority?: string; status?: string;
  start?: string; due?: string;
};

export async function runTaskCreate(opts: TaskCreateOpts): Promise<void> {
  if (opts.priority && !VALID_PRIORITIES.includes(opts.priority)) {
    throw new ValidationError(
      `Invalid priority: "${opts.priority}"`,
      `Valid values: ${VALID_PRIORITIES.join(', ')}`,
    );
  }
  const client = clientFor(opts.profile);
  const body: Record<string, unknown> = { title: opts.title };
  if (opts.status)   body.status = opts.status;
  if (opts.priority) body.priority = opts.priority;
  if (opts.start)    body.start_date = opts.start;
  if (opts.due)      body.due_date = opts.due;
  if (opts.project)  body.project_id = await resolveProjectId(client, opts.project);
  if (opts.assignee) body.assignee_id = await resolveAssigneeId(client, opts.assignee);

  const raw = await client.post('/api/tasks', body);
  const { data: t } = ItemEnvelope(TaskSchema).parse(raw);
  if (opts.json) { printJson(t); return; }
  success(`Task #${t.id} created: ${t.title ?? '—'}`);
}

export type TaskEditOpts = {
  profile: string; json: boolean; id: number;
  title?: string; priority?: string; assignee?: string; project?: string;
  start?: string; due?: string;
};

export async function runTaskEdit(opts: TaskEditOpts): Promise<void> {
  if (opts.priority && !VALID_PRIORITIES.includes(opts.priority)) {
    throw new ValidationError(
      `Invalid priority: "${opts.priority}"`,
      `Valid values: ${VALID_PRIORITIES.join(', ')}`,
    );
  }
  const body: Record<string, unknown> = {};
  if (opts.title)    body.title = opts.title;
  if (opts.priority) body.priority = opts.priority;
  if (opts.start)    body.start_date = opts.start;
  if (opts.due)      body.due_date = opts.due;

  const client = clientFor(opts.profile);
  if (opts.project)  body.project_id = await resolveProjectId(client, opts.project);
  if (opts.assignee) body.assignee_id = await resolveAssigneeId(client, opts.assignee);

  if (Object.keys(body).length === 0) throw new Error('Nothing to update. Provide at least one flag.');

  const raw = await client.patch(`/api/tasks/${opts.id}`, body);
  const { data: t } = ItemEnvelope(TaskSchema).parse(raw);
  if (opts.json) { printJson(t); return; }
  success(`Task #${t.id} updated`);
}

export type TaskCommentOpts = { profile: string; json: boolean; id: number; content: string };

export async function runTaskComment(opts: TaskCommentOpts): Promise<void> {
  const client = clientFor(opts.profile);
  const raw = await client.post(`/api/tasks/${opts.id}/comments`, { content: opts.content });
  const { data: c } = ItemEnvelope(CommentSchema).parse(raw);
  if (opts.json) { printJson(c); return; }
  success(`Comment added to task #${opts.id}`);
}
