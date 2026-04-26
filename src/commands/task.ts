import { ApiClient } from '../api/client.js';
import { ApiError } from '../api/errors.js';
import { ItemEnvelope, ListEnvelope, TaskSchema } from '../api/schemas.js';
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
