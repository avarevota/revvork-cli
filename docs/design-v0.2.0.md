# revvork-cli v0.2.0 — Design Spec

**Date:** 2026-04-28
**Status:** Draft, pending implementation plan
**Owner:** contact@revota.id
**Builds on:** `docs/superpowers/specs/2026-04-26-revvork-cli-design.md`

## 1. Goal

Extend `@revota/revvork-cli` with task creation, full task update, comment posting, and three minimal report views. Bump package version to `0.2.0`.

## 2. New Commands

### `revvork task create`

Create a new task. `--title` is required; all other flags are optional.

```
revvork task create --title "Fix auth bug" \
  [--project <code>]        project code, e.g. RVV
  [--assignee <email|id>]   assignee email or numeric id
  [--priority <p>]          Urgent | High | Medium | Low  (default: Medium)
  [--status <s>]            any valid status             (default: Backlog)
  [--start <YYYY-MM-DD>]
  [--due <YYYY-MM-DD>]
```

Prints the created task as a table or `--json`.

### `revvork task update <id>`

Update one or more fields on an existing task. At least one flag required.

```
revvork task update <id> \
  [--title "..."]
  [--priority <p>]
  [--assignee <email|id>]
  [--project <code>]
  [--start <YYYY-MM-DD>]
  [--due <YYYY-MM-DD>]
```

Status changes continue to use the existing `revvork task status <id> <status>` and `revvork task done <id>` commands. `task update` does not accept `--status` to keep concerns separate.

Prints the updated task as a table or `--json`. Exits with code 1 if no flags are provided.

### `revvork task comment <id> <content>`

Post a comment on a task.

```
revvork task comment 123 "Looks good, moving to review."
```

Prints `✓ Comment added to task #123` or `--json` with the comment object.

### `revvork report todo`

Lists To Do tasks for a project. `--project` is required.

```
revvork report todo --project RVV [--assignee <email|all>] [--json]
```

Output columns: `ID · Title · Priority · Assignee · Due`

### `revvork report overdue`

Lists active tasks (not Done/Deployed) where `due_date` is in the past.

```
revvork report overdue [--project <code>] [--assignee <email|all>] [--json]
```

- Fetches all active tasks matching filters, then filters client-side where `due_date < today`.
- Output columns: `ID · Title · Status · Priority · Assignee · Project · Due · Days overdue`
- "Days overdue" computed client-side: `today - due_date`.

### `revvork report assignee`

Shows a per-person task count broken down by status.

```
revvork report assignee [--project <code>] [--json]
```

- Fetches all active tasks (matching optional project filter), groups client-side by assignee email then status.
- Output: table with one row per assignee, columns for each active status + total.
- `--json` returns `[{ assignee: { id, email }, counts: { "To Do": N, "In Progress": N, ... }, total: N }]`.

## 3. Laravel API Changes

### 3.1 New: `POST /api/tasks`

**Auth:** `auth:sanctum`  
**Policy:** `TaskPolicy::create` (any authenticated user can create; server sets `creator_id` from the token user)

Request body:
```json
{
  "title": "string, required, max:255",
  "status": "nullable, in:Backlog,To Do,In Progress,In Review,Done,Deployed — default Backlog",
  "priority": "nullable, in:Urgent,High,Medium,Low — default Medium",
  "project_id": "nullable, integer, exists:projects,id",
  "assignee_id": "nullable, integer, exists:users,id",
  "start_date": "nullable, date",
  "due_date": "nullable, date"
}
```

Response: `201` with `{ data: TaskResource }`.  
Sets `creator_id = $request->user()->id` server-side.

### 3.2 Expand: `PATCH /api/tasks/{id}`

Add to existing validation (keeps `status`, `assignee_id`):
```json
{
  "title": "nullable, string, max:255",
  "priority": "nullable, in:Urgent,High,Medium,Low",
  "project_id": "nullable, integer, exists:projects,id",
  "start_date": "nullable, date",
  "due_date": "nullable, date"
}
```

All fields remain optional; only provided keys are updated (existing behavior preserved).

### 3.3 New: `POST /api/tasks/{task}/comments`

**Auth:** `auth:sanctum`

Request body:
```json
{ "content": "string, required, max:5000" }
```

Response: `201` with `{ data: CommentResource }`.  
Sets `user_id = $request->user()->id`.  
Uses the existing `Commentable` trait on `Task` (`$task->addComment($content, $userId)`).

### 3.4 New: `CommentResource`

```json
{
  "id": "integer",
  "content": "string",
  "user": { "id", "name", "email" },
  "created_at": "ISO 8601"
}
```

### 3.5 No new report endpoints

All three report commands use the existing `GET /api/tasks` with filters. Client-side filtering/grouping handles the rest.

## 4. CLI Architecture Changes

### New/modified files

| File | Change |
|------|--------|
| `src/commands/task.ts` | Add `runTaskCreate`, `runTaskUpdate`, `runTaskComment`; export types |
| `src/commands/report.ts` | New — `runReportTodo`, `runReportOverdue`, `runReportAssignee` |
| `src/api/schemas.ts` | Add `CommentSchema`, `ProjectSchema` (already exists, verify) |
| `src/errors/ValidationError.ts` | New — typed validation error with optional hint |
| `src/errors/suggestions.ts` | New — `suggest()` + `COMMAND_PATHS` for typo correction |
| `src/index.ts` | Wire new commands, add Commander error override for typo suggestions |
| `tests/commands/task.test.ts` | Expand with create/update/comment tests |
| `tests/commands/report.test.ts` | New |
| `tests/errors/suggestions.test.ts` | New — unit tests for `suggest()` |

### `runTaskCreate` logic

1. Resolve `project_id` from `--project <code>`: call `GET /api/tasks?project=<code>&limit=1` to get the project id — or better, add a minimal `GET /api/projects?code=<code>` helper or look up project_id from the task list response. **Simpler:** accept `--project` as a project code and pass it to a new `POST /api/tasks` body field `project_code` that the server resolves, OR add `GET /api/projects` endpoint. **Decision:** Add `GET /api/projects` (index, auth:sanctum) returning `[{ id, code, title }]` — reuse `ProjectResource`. This avoids brittle workarounds.
2. Resolve `assignee_id` from `--assignee <email>` via `GET /api/users` (already exists) — match by email client-side.
3. POST to `/api/tasks`, print result.

### `runTaskUpdate` logic

1. Same resolution for `--project` → `project_id` and `--assignee` → `assignee_id`.
2. If no update fields provided, exit with code 1 + message `Nothing to update. Provide at least one flag.`
3. PATCH to `/api/tasks/{id}`, print result.

### Report logic (all client-side aggregation)

- `report todo`: `GET /api/tasks?status=To Do&project=<code>[&assignee=<v>]`
- `report overdue`: `GET /api/tasks?status=Backlog,To Do,In Progress,In Review[&project][&assignee]&limit=200` → filter where `due_date && due_date < today`
- `report assignee`: `GET /api/tasks?status=Backlog,To Do,In Progress,In Review[&project]&assignee=all&limit=200` → group by `assignee.email`

## 5. Additional Laravel endpoint: `GET /api/projects`

Required for project code → id resolution in `task create` / `task update`.

**Auth:** `auth:sanctum`  
Returns: `{ data: [{ id, code, title }] }` via `ProjectResource`.  
No policy gate needed (projects are visible to all authenticated users).

## 6. Error handling

- `task create` with unknown `--project` code: `GET /api/projects` returns empty → CLI exits code 4, message `Project not found: <code>`.
- `task update` with no flags: exits code 1, message `Nothing to update. Provide at least one flag.`
- `task comment` with empty string: commander requires the argument, but if blank string: exits code 3.
- `report todo` without `--project`: exits code 1, message `--project is required for this report.`

## 6a. Helpful command error feedback

When a user makes a mistake at the command level, the CLI gives actionable feedback instead of a raw commander error.

### Unknown / misspelled command

Use a simple edit-distance (Levenshtein) function to suggest the closest known command.

```
$ revvork taks list
✗ Unknown command: taks

  Did you mean?  task list

  Run 'revvork --help' for all commands.
```

Implementation: override Commander's default error output via `.configureOutput()` and `.exitOverride()`. On `CommanderError` with code `commander.unknownCommand`, compute the closest match from a static list of known command paths (`login`, `logout`, `whoami`, `task list`, `task show`, `task create`, `task update`, `task done`, `task status`, `task comment`, `user list`, `report todo`, `report overdue`, `report assignee`) and print the suggestion.

### Missing required argument

When a required positional argument is omitted, print the command's usage + an example.

```
$ revvork task comment
✗ Missing argument: <content>

  Usage: revvork task comment <id> <content>
  Example: revvork task comment 123 "Looks good, moving to review."
```

Implementation: detect `commander.missingArgument` error code, look up a static `examples` map keyed by command name, print usage + example.

### Invalid enum value

When a flag receives a value outside the allowed set, show the valid options inline.

```
$ revvork task status 42 "Doing"
✗ Invalid status: "Doing"

  Valid values: Backlog, To Do, In Progress, In Review, Done, Deployed
```

```
$ revvork task create --priority Extreme
✗ Invalid priority: "Extreme"

  Valid values: Urgent, High, Medium, Low
```

Implementation: validate enum flags in each `run*` function before calling the API. Throw a typed `ValidationError` (new class, extends `Error`, not `ApiError`) that the top-level error handler renders with the valid-values hint. Exit code 3.

### New file: `src/errors/ValidationError.ts`

```ts
export class ValidationError extends Error {
  constructor(message: string, public hint?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

The top-level `.catch` in `src/index.ts` handles `ValidationError` → exit code 3, prints message + hint on next line.

### Modified file: `src/errors/suggestions.ts` (new)

Exports:
- `suggest(input: string, candidates: string[]): string | undefined` — returns closest match if edit distance ≤ 3, else undefined
- `COMMAND_PATHS: string[]` — static list of all valid command paths

## 7. Version bump

`package.json` version: `0.1.0` → `0.2.0`

## 8. Testing

**Laravel (PHPUnit):**
- `tests/Feature/Api/TaskCreateTest.php` — create happy path, missing title → 422, invalid priority → 422, invalid project_id → 422, unauthenticated → 401
- `tests/Feature/Api/TaskUpdateV2Test.php` — update title/priority/dates, existing status/assignee behavior unchanged
- `tests/Feature/Api/CommentApiTest.php` — create comment happy path, missing content → 422, unauthenticated → 401
- `tests/Feature/Api/ProjectApiTest.php` — index returns `[{ id, code, title }]`, unauthenticated → 401

**CLI (Vitest):**
- `tests/commands/task.test.ts` — expand: create happy path, update happy path, comment happy path, update with no flags exits code 1, invalid priority throws ValidationError, invalid status throws ValidationError
- `tests/commands/report.test.ts` — todo report, overdue filter (only returns tasks where due_date < today), assignee grouping
- `tests/errors/suggestions.test.ts` — exact match returns undefined, close typo returns suggestion, distant input returns undefined, case-insensitive match
