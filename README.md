# revvork-cli

CLI for the Revvork project-management app.

## Install

```bash
npm install
npm run build
node dist/index.cjs --help
# Or link globally:
npm link
revvork --help
```

## First use

```bash
revvork login --base-url http://localhost
# Email + password prompt, or paste a token:
revvork login --token <your-personal-access-token>
revvork whoami
```

## Commands

```bash
# Auth
revvork login                                    # interactive email + password
revvork login --token <token>                    # paste a personal access token
revvork logout                                   # revoke token server-side, clear local
revvork whoami                                   # print current user

# Tasks
revvork task list                                # active tasks assigned to me
revvork task list --assignee all                 # everyone's active tasks
revvork task list --assignee pic@example.com     # tasks assigned to specific user
revvork task list --project RVV                  # filter by project code
revvork task list --status "In Progress,In Review"
revvork task show 123
revvork task done 123                            # shortcut: mark as Done
revvork task status 123 "In Review"              # set arbitrary status

# Users
revvork user list                                # list users (for --assignee lookups)

# Machine output
revvork --json task list                         # JSON to stdout
```

## Profiles (multi-environment)

```bash
revvork --profile prod login --base-url https://revvork.example.com
revvork --profile prod task list
```

Config lives at `~/.config/revvork/config.json` (chmod 600). Tokens are stored in plaintext — protect the file accordingly.

## Exit codes

| Code | Meaning              |
|-----:|----------------------|
| 0    | success              |
| 1    | generic error        |
| 2    | auth error (401)     |
| 3    | validation / 4xx     |
| 4    | not found (404)      |
| 5    | network or 5xx       |

## Development

```bash
npm test               # run tests
npm run typecheck      # type check
npm run build          # build binary
npm run dev -- --help  # run via tsx without building
```
