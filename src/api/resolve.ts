import { ApiClient } from './client.js';
import { ApiError } from './errors.js';
import { ListEnvelope, ProjectSchema, UserSchema } from './schemas.js';

export async function resolveProjectId(client: ApiClient, code: string): Promise<number> {
  const raw = await client.get('/api/projects');
  const { data } = ListEnvelope(ProjectSchema).parse(raw);
  const project = data.find((p) => p.code?.toLowerCase() === code.toLowerCase());
  if (!project) throw new ApiError(404, `Project not found: ${code}`);
  return project.id;
}

export async function resolveAssigneeId(client: ApiClient, assignee: string): Promise<number> {
  if (/^\d+$/.test(assignee)) return Number(assignee);
  const raw = await client.get('/api/users');
  const { data } = ListEnvelope(UserSchema).parse(raw);
  const user = data.find((u) => u.email.toLowerCase() === assignee.toLowerCase());
  if (!user) throw new ApiError(404, `User not found: ${assignee}`);
  return user.id;
}
