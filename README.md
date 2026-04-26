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

## Use with AI Agents

The CLI is designed to be driven by AI agents (Claude, GPT, etc.) as a subprocess. Use `--json` for machine-readable output and check exit codes for error handling.

Example agent tool call:

```bash
revvork --json task list --assignee all --status "In Progress"
```

The agent receives structured JSON it can reason about, then calls `revvork task status <id> <status>` to take action.

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
