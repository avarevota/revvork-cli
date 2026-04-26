import prompts from 'prompts';
import { ApiClient } from '../api/client.js';
import { ApiError } from '../api/errors.js';
import { LoginResponseSchema, UserSchema } from '../api/schemas.js';
import { saveProfile, getActiveProfile } from '../config/profile.js';
import { success } from '../output/table.js';
import { printJson } from '../output/json.js';

export type LoginOpts = {
  baseUrl?: string;
  profile: string;
  token?: string;
  email?: string;
  json: boolean;
};

export async function runLogin(opts: LoginOpts): Promise<void> {
  const baseUrl = opts.baseUrl ?? getActiveProfile(opts.profile)?.baseUrl ?? 'http://localhost';

  if (opts.token) {
    const client = new ApiClient({ baseUrl, token: opts.token });
    const me = UserSchema.parse(await client.get('/api/auth/me'));
    saveProfile(opts.profile, { baseUrl, token: opts.token, email: me.email });
    if (opts.json) printJson({ ok: true, user: me, profile: opts.profile });
    else success(`Logged in as ${me.email} (profile: ${opts.profile})`);
    return;
  }

  const email = opts.email ?? (await prompts({ type: 'text', name: 'v', message: 'Email' })).v as string;
  const password = (await prompts({ type: 'password', name: 'v', message: 'Password' })).v as string;
  if (!email || !password) {
    process.stderr.write('Login cancelled.\n');
    process.exit(0);
  }

  const client = new ApiClient({ baseUrl });
  const raw = await client.post('/api/auth/login', { email, password });
  const parsed = LoginResponseSchema.parse(raw);
  saveProfile(opts.profile, { baseUrl, token: parsed.token, email: parsed.user.email });

  if (opts.json) printJson({ ok: true, user: parsed.user, profile: opts.profile });
  else success(`Logged in as ${parsed.user.email} (profile: ${opts.profile})`);
}
