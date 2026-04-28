import { Command, CommanderError } from 'commander';
import { ApiError } from './api/errors.js';
import { exitCodeFor } from './api/errors.js';
import { ValidationError } from './errors/ValidationError.js';
import { suggest, COMMAND_PATHS } from './errors/suggestions.js';
import { fail } from './output/table.js';
import { printJsonError } from './output/json.js';
import { runLogin } from './commands/login.js';
import { runLogout } from './commands/logout.js';
import { runWhoami } from './commands/whoami.js';
import { runTaskList, runTaskShow, runTaskUpdate, runTaskCreate, runTaskEdit, runTaskComment } from './commands/task.js';
import { runUserList } from './commands/user.js';
import { runReportTodo, runReportOverdue, runReportAssignee } from './commands/report.js';

const EXAMPLES: Record<string, string> = {
  'task comment': 'revvork task comment 123 "Looks good, moving to review."',
  'task create':  'revvork task create --title "Fix bug" --project RVV --priority High',
  'task update':  'revvork task update 123 --title "New title" --priority Urgent',
  'task show':    'revvork task show 123',
  'task status':  'revvork task status 123 "In Review"',
  'task done':    'revvork task done 123',
  'task list':    'revvork task list --assignee all --project RVV',
  'report todo':  'revvork report todo --project RVV',
  'report overdue': 'revvork report overdue --project RVV',
  'report assignee': 'revvork report assignee --project RVV',
  'login':        'revvork login --base-url https://your-app.com',
  'user list':    'revvork user list',
};

const program = new Command();
program
  .name('revvork')
  .description('CLI for the Revvork project-management app')
  .version('0.2.0')
  .option('--profile <name>', 'profile name', 'default')
  .option('--base-url <url>', 'override base URL for this run')
  .option('--json', 'machine-readable JSON output', false)
  .exitOverride();

// ── Auth ─────────────────────────────────────────────────────────────────────

program
  .command('login')
  .option('--token <token>', 'use a personal access token (skips email/password)')
  .option('--email <email>', 'email (otherwise prompted)')
  .exitOverride()
  .action(async (opts, cmd) => {
    const g = cmd.optsWithGlobals();
    await runLogin({ baseUrl: g.baseUrl as string | undefined, profile: g.profile as string, json: g.json as boolean, token: opts.token as string | undefined, email: opts.email as string | undefined });
  });

program.command('logout').exitOverride().action(async (_o, cmd) => {
  const g = cmd.optsWithGlobals();
  await runLogout({ profile: g.profile as string, json: g.json as boolean });
});

program.command('whoami').exitOverride().action(async (_o, cmd) => {
  const g = cmd.optsWithGlobals();
  await runWhoami({ profile: g.profile as string, json: g.json as boolean });
});

// ── Tasks ─────────────────────────────────────────────────────────────────────

const task = program.command('task').description('Manage tasks').exitOverride();

task.command('list').exitOverride()
  .option('--assignee <v>', 'me | <email> | <id> | all', 'me')
  .option('--project <code>', 'project code')
  .option('--status <csv>', 'comma-separated statuses (default: active only)')
  .option('--limit <n>', 'max rows (default 50)')
  .action(async (opts, cmd) => {
    const g = cmd.optsWithGlobals();
    await runTaskList({ profile: g.profile as string, json: g.json as boolean, assignee: opts.assignee as string, project: opts.project as string | undefined, status: opts.status as string | undefined, limit: opts.limit as string | undefined });
  });

task.command('show <id>').exitOverride().action(async (id: string, _o, cmd) => {
  const g = cmd.optsWithGlobals();
  await runTaskShow({ profile: g.profile as string, json: g.json as boolean, id: Number(id) });
});

task.command('create').exitOverride()
  .requiredOption('--title <title>', 'task title')
  .option('--project <code>', 'project code')
  .option('--assignee <email|id>', 'assignee email or id')
  .option('--priority <p>', 'Urgent | High | Medium | Low')
  .option('--status <s>', 'initial status (default: Backlog)')
  .option('--start <YYYY-MM-DD>', 'start date')
  .option('--due <YYYY-MM-DD>', 'due date')
  .action(async (opts, cmd) => {
    const g = cmd.optsWithGlobals();
    await runTaskCreate({ profile: g.profile as string, json: g.json as boolean, title: opts.title as string, project: opts.project as string | undefined, assignee: opts.assignee as string | undefined, priority: opts.priority as string | undefined, status: opts.status as string | undefined, start: opts.start as string | undefined, due: opts.due as string | undefined });
  });

task.command('update <id>').exitOverride()
  .option('--title <title>')
  .option('--priority <p>', 'Urgent | High | Medium | Low')
  .option('--assignee <email|id>')
  .option('--project <code>')
  .option('--start <YYYY-MM-DD>')
  .option('--due <YYYY-MM-DD>')
  .action(async (id: string, opts, cmd) => {
    const g = cmd.optsWithGlobals();
    await runTaskEdit({ profile: g.profile as string, json: g.json as boolean, id: Number(id), title: opts.title as string | undefined, priority: opts.priority as string | undefined, assignee: opts.assignee as string | undefined, project: opts.project as string | undefined, start: opts.start as string | undefined, due: opts.due as string | undefined });
  });

task.command('done <id>').exitOverride().action(async (id: string, _o, cmd) => {
  const g = cmd.optsWithGlobals();
  await runTaskUpdate({ profile: g.profile as string, json: g.json as boolean, id: Number(id), status: 'Done' });
});

task.command('status <id> <newStatus>').exitOverride().action(async (id: string, newStatus: string, _o, cmd) => {
  const g = cmd.optsWithGlobals();
  await runTaskUpdate({ profile: g.profile as string, json: g.json as boolean, id: Number(id), status: newStatus });
});

task.command('comment <id> <content>').exitOverride().action(async (id: string, content: string, _o, cmd) => {
  const g = cmd.optsWithGlobals();
  await runTaskComment({ profile: g.profile as string, json: g.json as boolean, id: Number(id), content });
});

// ── Users ─────────────────────────────────────────────────────────────────────

const user = program.command('user').description('Manage users').exitOverride();
user.command('list').exitOverride().action(async (_o, cmd) => {
  const g = cmd.optsWithGlobals();
  await runUserList({ profile: g.profile as string, json: g.json as boolean });
});

// ── Reports ───────────────────────────────────────────────────────────────────

const report = program.command('report').description('Admin reports').exitOverride();

report.command('todo').exitOverride()
  .requiredOption('--project <code>', 'project code (required)')
  .option('--assignee <email|all>', 'filter by assignee (default: all)')
  .action(async (opts, cmd) => {
    const g = cmd.optsWithGlobals();
    await runReportTodo({ profile: g.profile as string, json: g.json as boolean, project: opts.project as string, assignee: opts.assignee as string | undefined });
  });

report.command('overdue').exitOverride()
  .option('--project <code>')
  .option('--assignee <email|all>')
  .action(async (opts, cmd) => {
    const g = cmd.optsWithGlobals();
    await runReportOverdue({ profile: g.profile as string, json: g.json as boolean, project: opts.project as string | undefined, assignee: opts.assignee as string | undefined });
  });

report.command('assignee').exitOverride()
  .option('--project <code>')
  .action(async (opts, cmd) => {
    const g = cmd.optsWithGlobals();
    await runReportAssignee({ profile: g.profile as string, json: g.json as boolean, project: opts.project as string | undefined });
  });

// ── Error handling ────────────────────────────────────────────────────────────

function handleError(err: unknown): never {
  const isJson = program.opts().json as boolean;

  if (err instanceof CommanderError) {
    if (err.code === 'commander.unknownCommand' || err.code === 'commander.unknownOption') {
      const input = process.argv.slice(2).join(' ');
      const hit = suggest(input, COMMAND_PATHS);
      process.stderr.write(`\n✗ Unknown command: ${input}\n`);
      if (hit) process.stderr.write(`\n  Did you mean?  ${hit}\n`);
      process.stderr.write(`\n  Run 'revvork --help' for all commands.\n\n`);
      process.exit(1);
    }
    if (err.code === 'commander.missingArgument' || err.code === 'commander.missingMandatoryOptionValue') {
      const cmdName = process.argv.slice(2).join(' ');
      process.stderr.write(`\n✗ ${err.message}\n`);
      const ex = EXAMPLES[cmdName];
      if (ex) process.stderr.write(`\n  Example: ${ex}\n\n`);
      process.exit(1);
    }
    process.stderr.write(`\n✗ ${err.message}\n\n`);
    process.exit(1);
  }

  if (err instanceof ValidationError) {
    if (isJson) {
      printJsonError({ code: 3, message: err.message, details: err.hint });
    } else {
      process.stderr.write(`\n✗ ${err.message}\n`);
      if (err.hint) process.stderr.write(`\n  ${err.hint}\n\n`);
    }
    process.exit(3);
  }

  const code = exitCodeFor(err);
  if (isJson) {
    printJsonError({ code, message: err instanceof Error ? err.message : String(err), details: err instanceof ApiError ? err.details : undefined });
  } else {
    fail(err instanceof Error ? err.message : String(err));
    if (code === 2) process.stderr.write('  Hint: run `revvork login`\n');
  }
  process.exit(code);
}

program.parseAsync(process.argv).catch(handleError);
