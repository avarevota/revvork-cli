import { ApiClient } from '../api/client.js';
import { ApiError } from '../api/errors.js';
import { ListEnvelope, UserSchema } from '../api/schemas.js';
import { getActiveProfile } from '../config/profile.js';
import { printTable } from '../output/table.js';
import { printJson } from '../output/json.js';

export type UserListOpts = { profile: string; json: boolean };

export async function runUserList(opts: UserListOpts): Promise<void> {
  const p = getActiveProfile(opts.profile);
  if (!p?.token) throw new ApiError(401, 'Not logged in. Run: revvork login');
  const client = new ApiClient({ baseUrl: p.baseUrl, token: p.token });
  const raw = await client.get('/api/users');
  const { data } = ListEnvelope(UserSchema).parse(raw);
  if (opts.json) { printJson(data); return; }
  printTable(['ID', 'Name', 'Email', 'Role'], data.map((u) => [u.id, u.name ?? null, u.email, u.role ?? null]));
}
