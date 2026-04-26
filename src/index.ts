import { Command } from 'commander';
import { ApiError } from './api/errors.js';
import { exitCodeFor } from './api/errors.js';
import { fail } from './output/table.js';
import { printJsonError } from './output/json.js';
import { runLogin } from './commands/login.js';
import { runLogout } from './commands/logout.js';
import { runWhoami } from './commands/whoami.js';

const program = new Command();
program
  .name('revvork')
  .description('CLI for the Revvork project-management app')
  .version('0.1.0')
  .option('--profile <name>', 'profile name', 'default')
  .option('--base-url <url>', 'override base URL for this run')
  .option('--json', 'machine-readable JSON output', false);

program
  .command('login')
  .option('--token <token>', 'use a personal access token (skips email/password)')
  .option('--email <email>', 'email (otherwise prompted)')
  .option('--password <password>', 'password (otherwise prompted)')
  .action(async (opts, cmd) => {
    const g = cmd.optsWithGlobals();
    await runLogin({
      baseUrl: g.baseUrl, profile: g.profile, json: g.json,
      token: opts.token, email: opts.email, password: opts.password,
    });
  });

program.command('logout').action(async (_o, cmd) => {
  const g = cmd.optsWithGlobals();
  await runLogout({ profile: g.profile, json: g.json });
});

program.command('whoami').action(async (_o, cmd) => {
  const g = cmd.optsWithGlobals();
  await runWhoami({ profile: g.profile, json: g.json });
});

program.parseAsync(process.argv).catch((err: unknown) => {
  const code = exitCodeFor(err);
  if (program.opts().json as boolean) {
    printJsonError({ code, message: err instanceof Error ? err.message : String(err), details: err instanceof ApiError ? err.details : undefined });
  } else {
    fail(err instanceof Error ? err.message : String(err));
    if (code === 2) process.stderr.write('  Hint: run `revvork login`\n');
  }
  process.exit(code);
});
