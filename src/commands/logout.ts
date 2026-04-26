import { ApiClient } from '../api/client.js';
import { ApiError } from '../api/errors.js';
import { clearProfileToken, getActiveProfile } from '../config/profile.js';
import { success, warn } from '../output/table.js';
import { printJson } from '../output/json.js';

export type LogoutOpts = { profile: string; json: boolean };

export async function runLogout(opts: LogoutOpts): Promise<void> {
  const p = getActiveProfile(opts.profile);
  if (!p?.token) {
    if (opts.json) printJson({ ok: true, note: 'no active token' });
    else warn('No active token; nothing to revoke.');
    return;
  }
  const client = new ApiClient({ baseUrl: p.baseUrl, token: p.token });
  try {
    await client.post('/api/auth/logout');
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) throw e;
  }
  clearProfileToken(opts.profile);
  if (opts.json) printJson({ ok: true });
  else success('Logged out.');
}
