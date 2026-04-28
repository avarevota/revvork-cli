import { ApiClient } from '../api/client.js';
import { ApiError } from '../api/errors.js';
import { ListEnvelope, TaskSchema } from '../api/schemas.js';
import { getActiveProfile } from '../config/profile.js';
import { printTable } from '../output/table.js';
import { printJson } from '../output/json.js';

const ACTIVE_STATUSES = 'Backlog,To Do,In Progress,In Review';

function clientFor(profile: string): ApiClient {
  const p = getActiveProfile(profile);
  if (!p?.token) throw new ApiError(401, 'Not logged in. Run: revvork login');
  return new ApiClient({ baseUrl: p.baseUrl, token: p.token });
}

export type ReportTodoOpts = { profile: string; json: boolean; project?: string; assignee?: string };

export async function runReportTodo(opts: ReportTodoOpts): Promise<void> {
  if (!opts.project) throw new Error('--project is required for this report.');
  const client = clientFor(opts.profile);
  const raw = await client.get('/api/tasks', {
    status: 'To Do',
    project: opts.project,
    assignee: opts.assignee ?? 'all',
  });
  const { data } = ListEnvelope(TaskSchema).parse(raw);
  if (opts.json) { printJson(data); return; }
  if (data.length === 0) { process.stdout.write('No To Do tasks found.\n'); return; }
  printTable(
    ['ID', 'Title', 'Priority', 'Assignee', 'Due'],
    data.map((t) => [t.id, t.title ?? null, t.priority ?? null, t.assignee?.email ?? null, t.due_date ?? null]),
  );
}

export type ReportOverdueOpts = { profile: string; json: boolean; project?: string; assignee?: string };

export async function runReportOverdue(opts: ReportOverdueOpts): Promise<void> {
  const client = clientFor(opts.profile);
  const today = new Date().toISOString().split('T')[0]!;
  const raw = await client.get('/api/tasks', {
    status: ACTIVE_STATUSES,
    assignee: opts.assignee ?? 'all',
    project: opts.project,
    limit: '200',
  });
  const { data } = ListEnvelope(TaskSchema).parse(raw);
  const overdue = data.filter((t) => t.due_date && t.due_date < today);

  if (opts.json) {
    printJson(overdue.map((t) => ({
      ...t,
      days_overdue: Math.floor((Date.now() - new Date(t.due_date!).getTime()) / 86400000),
    })));
    return;
  }
  if (overdue.length === 0) { process.stdout.write('No overdue tasks.\n'); return; }
  printTable(
    ['ID', 'Title', 'Status', 'Priority', 'Assignee', 'Project', 'Due', 'Days overdue'],
    overdue.map((t) => [
      t.id, t.title ?? null, t.status ?? null, t.priority ?? null,
      t.assignee?.email ?? null, t.project?.code ?? null, t.due_date ?? null,
      Math.floor((Date.now() - new Date(t.due_date!).getTime()) / 86400000),
    ]),
  );
}

export type ReportAssigneeOpts = { profile: string; json: boolean; project?: string };

export async function runReportAssignee(opts: ReportAssigneeOpts): Promise<void> {
  const client = clientFor(opts.profile);
  const raw = await client.get('/api/tasks', {
    status: ACTIVE_STATUSES,
    assignee: 'all',
    project: opts.project,
    limit: '200',
  });
  const { data } = ListEnvelope(TaskSchema).parse(raw);

  const map = new Map<string, { assignee: { id: number; email: string }; counts: Record<string, number>; total: number }>();
  for (const t of data) {
    const email = t.assignee?.email ?? '(unassigned)';
    const id = t.assignee?.id ?? 0;
    if (!map.has(email)) map.set(email, { assignee: { id, email }, counts: {}, total: 0 });
    const row = map.get(email)!;
    const s = t.status ?? 'Unknown';
    row.counts[s] = (row.counts[s] ?? 0) + 1;
    row.total++;
  }

  const rows = [...map.values()].sort((a, b) => b.total - a.total);
  if (opts.json) { printJson(rows); return; }
  if (rows.length === 0) { process.stdout.write('No active tasks found.\n'); return; }

  const statuses = [...new Set(data.map((t) => t.status ?? 'Unknown'))];
  printTable(
    ['Assignee', ...statuses, 'Total'],
    rows.map((r) => [r.assignee.email, ...statuses.map((s) => r.counts[s] ?? 0), r.total]),
  );
}
