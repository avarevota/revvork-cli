# @revota/revvork-cli

Command-line interface for [Revvork](https://github.com/avarevota/revvork) — a project management app built for teams. Lets your admin team interact with projects and tasks directly from the terminal, and works equally well as a tool surface for AI agents.

## Installation

```bash
npm install -g @revota/revvork-cli
```

Or run without installing:

```bash
npx @revota/revvork-cli --help
```

## Requirements

- Node.js 20+
- A running Revvork instance (self-hosted or deployed)

## Quick Start

```bash
# 1. Log in (prompts for email + password)
revvork login --base-url https://your-revvork-app.com

# 2. See who you are
revvork whoami

# 3. List your active tasks
revvork task list
```

## Authentication

```bash
# Interactive login (recommended)
revvork login --base-url https://your-revvork-app.com

# Login with a personal access token
revvork login --base-url https://your-revvork-app.com --token <token>

# Check current session
revvork whoami

# Log out (revokes token server-side)
revvork logout
```

Credentials are stored at `~/.config/revvork/config.json` (chmod 600). Tokens are stored in plaintext — protect the file on shared machines.

## Commands

### `revvork task list`

Lists active tasks (excludes Done and Deployed). Defaults to tasks assigned to you.

```bash
revvork task list                                   # my active tasks
revvork task list --assignee all                    # everyone's active tasks
revvork task list --assignee budi@company.com       # tasks for a specific user
revvork task list --project RVV                     # filter by project code
revvork task list --status "In Progress,In Review"  # filter by status (comma-separated)
revvork task list --limit 20                        # limit rows (default: 50)
```

**Available statuses:** `Backlog` · `To Do` · `In Progress` · `In Review` · `Done` · `Deployed`

### `revvork task show <id>`

Show full details for a task.

```bash
revvork task show 123
```

### `revvork task done <id>`

Mark a task as Done.

```bash
revvork task done 123
```

### `revvork task status <id> <status>`

Set a task to any status.

```bash
revvork task status 123 "In Review"
revvork task status 123 Deployed
```

### `revvork user list`

List all users — useful for looking up emails to use with `--assignee`.

```bash
revvork user list
```

## Global Options

These flags work with any command:

| Flag | Description |
|------|-------------|
| `--profile <name>` | Use a named profile (default: `default`) |
| `--base-url <url>` | Override the base URL for this run |
| `--json` | Output raw JSON instead of a table |
| `--version` | Print version |
| `--help` | Show help |

## Profiles

Profiles let you switch between environments (local, staging, production) without re-logging in.

```bash
# Set up a production profile
revvork --profile prod login --base-url https://revvork.company.com

# Use it
revvork --profile prod task list
revvork --profile prod task done 99

# Local is still the default
revvork task list
```

## Machine-readable output

Pass `--json` to get structured JSON on stdout. Errors go to stderr as `{ "error": { "code", "message" } }`. Useful for scripting or AI agents.

```bash
revvork --json task list
revvork --json task show 123
revvork --json task status 123 "In Review"
revvork --json user list
```

Example output:

```json
[
  {
    "id": 42,
    "title": "Fix login redirect",
    "status": "In Progress",
    "priority": "High",
    "assignee": { "id": 3, "email": "budi@company.com" },
    "project": { "code": "RVV", "title": "Revvork" },
    "due_date": "2026-05-10"
  }
]
```

## Exit Codes

| Code | Meaning |
|-----:|---------|
| 0 | Success |
| 1 | Generic error |
| 2 | Auth error — not logged in or token expired |
| 3 | Validation or permission error (4xx) |
| 4 | Not found (404) |
| 5 | Network or server error (5xx) |

Hint: exit code 2 always prints `run: revvork login` to stderr.

## Using with AI Agents

`revvork-cli` is designed to be driven by AI agents (Claude Code, Claude Desktop, custom LLM agents, etc.) as a subprocess tool. The `--json` flag makes every command output structured, parseable JSON — no screen-scraping needed.

### How it works

The agent runs CLI commands as shell tools, reads the JSON output, reasons about it, and calls the next command. Errors go to stderr with a numeric exit code the agent can branch on.

```
Agent  →  revvork --json task list --assignee all
       ←  [{ "id": 42, "title": "...", "status": "In Progress", ... }]

Agent  →  revvork --json task status 42 "In Review"
       ←  { "id": 42, "status": "In Review", ... }
```

### Setup for an agent

Before the agent can act, authenticate once and store the token in a named profile:

```bash
revvork --profile agent login \
  --base-url https://your-revvork-app.com \
  --token <personal-access-token>
```

The agent then always passes `--profile agent --json` to use that session.

### Claude Code

Add `revvork` as a shell tool in your `CLAUDE.md` or system prompt. Example:

```markdown
## Tools available

- `revvork --profile agent --json task list [--assignee <email|all>] [--project <code>] [--status <csv>]`
  Lists active tasks. Returns a JSON array.

- `revvork --profile agent --json task show <id>`
  Returns full detail for one task.

- `revvork --profile agent --json task status <id> <status>`
  Updates task status. Valid values: Backlog, To Do, In Progress, In Review, Done, Deployed.

- `revvork --profile agent --json task done <id>`
  Shortcut: marks task as Done.

- `revvork --profile agent --json user list`
  Returns all users. Use to resolve names/emails for --assignee.
```

Claude Code can then run these directly in the terminal during a session. Example prompt:

> "Show me all overdue In Progress tasks assigned to the team and move the ones with no activity to Backlog."

Claude will call `task list --assignee all --status "In Progress"`, inspect `due_date` and `last_activity_at`, then call `task status <id> Backlog` for each stale task.

### Custom LLM agent (tool use / function calling)

Define the CLI commands as tools in your agent's tool schema. Example for the Anthropic API:

```json
{
  "name": "revvork_task_list",
  "description": "List active tasks in Revvork. Returns a JSON array of tasks.",
  "input_schema": {
    "type": "object",
    "properties": {
      "assignee": {
        "type": "string",
        "description": "Filter by assignee: 'me', 'all', or an email address"
      },
      "project": {
        "type": "string",
        "description": "Filter by project code, e.g. 'RVV'"
      },
      "status": {
        "type": "string",
        "description": "Comma-separated statuses, e.g. 'In Progress,In Review'"
      }
    }
  }
}
```

When the model calls `revvork_task_list`, your tool handler runs:

```ts
const args = ['--profile', 'agent', '--json', 'task', 'list'];
if (input.assignee) args.push('--assignee', input.assignee);
if (input.project)  args.push('--project', input.project);
if (input.status)   args.push('--status', input.status);

const { stdout, stderr, exitCode } = await execa('revvork', args);

if (exitCode === 0) return JSON.parse(stdout);
throw new Error(`revvork error (${exitCode}): ${stderr}`);
```

### Exit codes for agent error handling

| Code | Meaning | Agent action |
|-----:|---------|--------------|
| 0 | Success | Parse stdout as JSON |
| 2 | Auth error | Re-authenticate, then retry |
| 3 | Validation / permission | Report to user, do not retry |
| 4 | Not found | Report to user, do not retry |
| 5 | Network / server error | Retry with backoff |

### Example agent workflows

**Daily standup digest**
```
task list --assignee all --status "In Progress,In Review"
→ summarise who is working on what, flag tasks overdue
```

**Triage unstarted backlog**
```
task list --assignee all --status Backlog --limit 50
→ for each task without an assignee: ask manager to assign or defer
```

**Auto-close deployed tasks**
```
task list --assignee all --status "In Review" --project RVV
→ for each task confirmed deployed: task status <id> Deployed
```

## Development

```bash
git clone https://github.com/avarevota/revvork-cli.git
cd revvork-cli
npm install

npm test          # run tests (22 tests)
npm run typecheck # TypeScript check
npm run build     # build dist/index.cjs
npm run dev -- task list  # run without building (via tsx)
```

## Contributing

Issues and PRs welcome at [github.com/avarevota/revvork-cli](https://github.com/avarevota/revvork-cli).

## License

MIT
