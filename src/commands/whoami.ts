import { ApiClient } from '../api/client.js';
import { ApiError } from '../api/errors.js';
import { UserSchema } from '../api/schemas.js';
import { getActiveProfile } from '../config/profile.js';
import { printTable } from '../output/table.js';
import { printJson } from '../output/json.js';

export type WhoamiOpts = { profile: string; json: boolean };

export async function runWhoami(opts: WhoamiOpts): Promise<void> {
  const p = getActiveProfile(opts.profile);
  if (!p?.token) throw new ApiError(401, 'Not logged in. Run: revvork login');
  const client = new ApiClient({ baseUrl: p.baseUrl, token: p.token });
  const me = UserSchema.parse(await client.get('/api/auth/me'));
  if (opts.json) printJson(me);
  else printTable(['ID', 'Name', 'Email', 'Role'], [[me.id, me.name ?? null, me.email, me.role ?? null]]);
}
