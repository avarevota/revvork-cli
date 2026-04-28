# revvork-cli v0.2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add task creation, full task update, comment posting, three report commands, and helpful command-error feedback to `@revota/revvork-cli`, bumping to v0.2.0.

**Architecture:** Laravel side adds `POST /api/tasks`, `POST /api/tasks/{id}/comments`, `GET /api/projects`, and expands `PATCH /api/tasks/{id}`. CLI side adds new commands in `task.ts` and a new `report.ts`, plus a `ValidationError` + `suggestions.ts` for typo correction — all wired into `index.ts`.

**Tech Stack:** Laravel 11 / Sanctum / PHPUnit (server); Node 20 / TypeScript / Commander / undici / zod / vitest (CLI)

**Spec:** `docs/design-v0.2.0.md`

**Conventions:**
- Laravel work: `/home/herwindo/dev/revvork/revvork/` (main branch — no worktree needed, build on existing feature branch commits)
- CLI work: `/home/herwindo/dev/revvork/revvork-cli/`
- PHP/Sail unavailable in shell — write all Laravel files and commit; note tests need Docker
- Status enum: `Backlog · To Do · In Progress · In Review · Done · Deployed`
- Priority enum: `Urgent · High · Medium · Low`

---

## File Map

### Laravel (`revvork/`)
| Action | File |
|--------|------|
| Create | `app/Http/Controllers/Api/ProjectController.php` |
| Create | `app/Http/Controllers/Api/CommentController.php` |
| Create | `app/Http/Resources/CommentResource.php` |
| Modify | `app/Http/Controllers/Api/TaskController.php` — add `store`, expand `update` |
| Modify | `routes/api.php` — add 3 new routes |
| Create | `tests/Feature/Api/ProjectApiTest.php` |
| Create | `tests/Feature/Api/TaskCreateTest.php` |
| Create | `tests/Feature/Api/TaskUpdateV2Test.php` |
| Create | `tests/Feature/Api/CommentApiTest.php` |

### CLI (`revvork-cli/`)
| Action | File |
|--------|------|
| Modify | `src/api/schemas.ts` — add `CommentSchema`, `ProjectListSchema` |
| Create | `src/api/resolve.ts` — `resolveProjectId`, `resolveAssigneeId` helpers |
| Create | `src/errors/ValidationError.ts` |
| Create | `src/errors/suggestions.ts` |
| Modify | `src/commands/task.ts` — add `runTaskCreate`, `runTaskEdit`, `runTaskComment` |
| Create | `src/commands/report.ts` — `runReportTodo`, `runReportOverdue`, `runReportAssignee` |
| Modify | `src/index.ts` — wire new commands + commander error override |
| Modify | `package.json` — version `0.1.0` → `0.2.0` |
| Modify | `README.md` — document new commands |
| Create | `tests/api/resolve.test.ts` |
| Create | `tests/errors/suggestions.test.ts` |
| Modify | `tests/commands/task.test.ts` — expand |
| Create | `tests/commands/report.test.ts` |

---

## Part A — Laravel API

### Task A1: `GET /api/projects` endpoint — TDD

**Files:**
- Create: `app/Http/Controllers/Api/ProjectController.php`
- Create: `tests/Feature/Api/ProjectApiTest.php`
- Modify: `routes/api.php`

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Api/ProjectApiTest.php`:

```php
<?php

namespace Tests\Feature\Api;

use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProjectApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_index_returns_projects(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        Project::factory()->count(3)->create();

        $res = $this->getJson('/api/projects');

        $res->assertOk();
        $this->assertCount(3, $res->json('data'));
        $this->assertArrayHasKey('code', $res->json('data.0'));
        $this->assertArrayHasKey('title', $res->json('data.0'));
    }

    public function test_index_requires_auth(): void
    {
        $this->getJson('/api/projects')->assertStatus(401);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./vendor/bin/sail artisan test --filter=ProjectApiTest`
Expected: FAIL (route not found).

- [ ] **Step 3: Create `ProjectController`**

Create `app/Http/Controllers/Api/ProjectController.php`:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProjectResource;
use App\Models\Project;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProjectController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return ProjectResource::collection(
            Project::query()->orderBy('title')->get()
        );
    }
}
```

- [ ] **Step 4: Add route to `routes/api.php`**

Read `routes/api.php`. Add inside the existing `auth:sanctum` + `throttle:api` group, alongside the existing `/tasks` and `/users` routes:

```php
use App\Http\Controllers\Api\ProjectController;

Route::get('/projects', [ProjectController::class, 'index']);
```

- [ ] **Step 5: Run tests**

Run: `./vendor/bin/sail artisan test --filter=ProjectApiTest`
Expected: 2 passing.

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/Api/ProjectController.php routes/api.php tests/Feature/Api/ProjectApiTest.php
git commit -m "feat(api): add projects index endpoint"
```

---

### Task A2: `POST /api/tasks` (create) — TDD

**Files:**
- Modify: `app/Http/Controllers/Api/TaskController.php` — add `store` method
- Modify: `routes/api.php` — add POST route
- Create: `tests/Feature/Api/TaskCreateTest.php`

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Api/TaskCreateTest.php`:

```php
<?php

namespace Tests\Feature\Api;

use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TaskCreateTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $user = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($user);
        return $user;
    }

    public function test_create_minimal_task(): void
    {
        $this->admin();

        $res = $this->postJson('/api/tasks', ['title' => 'New task']);

        $res->assertStatus(201)
            ->assertJson(['data' => ['title' => 'New task', 'status' => 'Backlog', 'priority' => 'Medium']]);
    }

    public function test_create_task_with_all_fields(): void
    {
        $user = $this->admin();
        $project = Project::factory()->create();

        $res = $this->postJson('/api/tasks', [
            'title' => 'Full task',
            'status' => 'To Do',
            'priority' => 'High',
            'project_id' => $project->id,
            'assignee_id' => $user->id,
            'start_date' => '2026-05-01',
            'due_date' => '2026-05-10',
        ]);

        $res->assertStatus(201)
            ->assertJson(['data' => ['title' => 'Full task', 'status' => 'To Do', 'priority' => 'High']]);
    }

    public function test_create_sets_creator_id(): void
    {
        $user = $this->admin();

        $this->postJson('/api/tasks', ['title' => 'Check creator'])->assertStatus(201);

        $this->assertDatabaseHas('tasks', ['title' => 'Check creator', 'creator_id' => $user->id]);
    }

    public function test_create_requires_title(): void
    {
        $this->admin();
        $this->postJson('/api/tasks', [])->assertStatus(422)->assertJsonValidationErrors('title');
    }

    public function test_create_rejects_invalid_status(): void
    {
        $this->admin();
        $this->postJson('/api/tasks', ['title' => 'T', 'status' => 'Bogus'])->assertStatus(422)->assertJsonValidationErrors('status');
    }

    public function test_create_rejects_invalid_priority(): void
    {
        $this->admin();
        $this->postJson('/api/tasks', ['title' => 'T', 'priority' => 'Extreme'])->assertStatus(422)->assertJsonValidationErrors('priority');
    }

    public function test_create_requires_auth(): void
    {
        $this->postJson('/api/tasks', ['title' => 'T'])->assertStatus(401);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./vendor/bin/sail artisan test --filter=TaskCreateTest`
Expected: all FAIL (route missing).

- [ ] **Step 3: Add `store` method to `TaskController`**

Read `app/Http/Controllers/Api/TaskController.php`. Add this method after the `index` method and before `show`:

```php
use Illuminate\Http\JsonResponse;

public function store(Request $request): JsonResponse
{
    $data = $request->validate([
        'title'       => ['required', 'string', 'max:255'],
        'status'      => ['nullable', 'in:' . implode(',', self::STATUSES)],
        'priority'    => ['nullable', 'in:Urgent,High,Medium,Low'],
        'project_id'  => ['nullable', 'integer', 'exists:projects,id'],
        'assignee_id' => ['nullable', 'integer', 'exists:users,id'],
        'start_date'  => ['nullable', 'date'],
        'due_date'    => ['nullable', 'date'],
    ]);

    $data['creator_id'] = $request->user()->id;
    $data['status']     = $data['status'] ?? 'Backlog';
    $data['priority']   = $data['priority'] ?? 'Medium';

    $task = Task::create($data);
    $task->load(['project', 'assignee']);

    return (new TaskResource($task))->response()->setStatusCode(201);
}
```

Also add `use Illuminate\Http\JsonResponse;` to the imports at the top of the file if not already present.

- [ ] **Step 4: Add route**

In `routes/api.php`, inside the `auth:sanctum` + `throttle:api` group, add:

```php
Route::post('/tasks', [TaskController::class, 'store']);
```

- [ ] **Step 5: Run tests**

Run: `./vendor/bin/sail artisan test --filter=TaskCreateTest`
Expected: 7 passing.

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/Api/TaskController.php routes/api.php tests/Feature/Api/TaskCreateTest.php
git commit -m "feat(api): add POST /api/tasks create endpoint"
```

---

### Task A3: Expand `PATCH /api/tasks/{id}` — TDD

**Files:**
- Modify: `app/Http/Controllers/Api/TaskController.php` — expand `update`
- Create: `tests/Feature/Api/TaskUpdateV2Test.php`

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Api/TaskUpdateV2Test.php`:

```php
<?php

namespace Tests\Feature\Api;

use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TaskUpdateV2Test extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $user = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($user);
        return $user;
    }

    public function test_update_title(): void
    {
        $this->admin();
        $task = Task::factory()->create(['title' => 'Old title']);

        $this->patchJson("/api/tasks/{$task->id}", ['title' => 'New title'])
            ->assertOk()
            ->assertJson(['data' => ['title' => 'New title']]);

        $this->assertSame('New title', $task->fresh()->title);
    }

    public function test_update_priority(): void
    {
        $this->admin();
        $task = Task::factory()->create(['priority' => 'Low']);

        $this->patchJson("/api/tasks/{$task->id}", ['priority' => 'Urgent'])
            ->assertOk()
            ->assertJson(['data' => ['priority' => 'Urgent']]);
    }

    public function test_update_due_date(): void
    {
        $this->admin();
        $task = Task::factory()->create();

        $this->patchJson("/api/tasks/{$task->id}", ['due_date' => '2026-06-01'])
            ->assertOk()
            ->assertJson(['data' => ['due_date' => '2026-06-01']]);
    }

    public function test_update_project(): void
    {
        $this->admin();
        $task = Task::factory()->create(['project_id' => null]);
        $project = Project::factory()->create();

        $this->patchJson("/api/tasks/{$task->id}", ['project_id' => $project->id])
            ->assertOk();

        $this->assertSame($project->id, $task->fresh()->project_id);
    }

    public function test_update_rejects_invalid_priority(): void
    {
        $this->admin();
        $task = Task::factory()->create();

        $this->patchJson("/api/tasks/{$task->id}", ['priority' => 'Extreme'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('priority');
    }

    public function test_existing_status_update_still_works(): void
    {
        $this->admin();
        $task = Task::factory()->create(['status' => 'To Do']);

        $this->patchJson("/api/tasks/{$task->id}", ['status' => 'In Progress'])
            ->assertOk()
            ->assertJson(['data' => ['status' => 'In Progress']]);
    }
}
```

- [ ] **Step 2: Run tests — most should already pass, `update_title/priority/due_date/project` will fail**

Run: `./vendor/bin/sail artisan test --filter=TaskUpdateV2Test`
Expected: `test_existing_status_update_still_works` passes, others FAIL.

- [ ] **Step 3: Expand `update` in `TaskController`**

Replace the existing `update` method with:

```php
public function update(Request $request, Task $task): TaskResource
{
    $this->authorize('update', $task);

    $data = $request->validate([
        'title'       => ['nullable', 'string', 'max:255'],
        'status'      => ['nullable', 'in:' . implode(',', self::STATUSES)],
        'priority'    => ['nullable', 'in:Urgent,High,Medium,Low'],
        'assignee_id' => ['nullable', 'integer', 'exists:users,id'],
        'project_id'  => ['nullable', 'integer', 'exists:projects,id'],
        'start_date'  => ['nullable', 'date'],
        'due_date'    => ['nullable', 'date'],
    ]);

    $task->update(array_filter($data, fn ($v) => $v !== null));
    $task->load(['project', 'assignee']);
    return new TaskResource($task);
}
```

> **Note:** `array_filter($data, fn ($v) => $v !== null)` ensures only explicitly provided (non-null) keys update the record. This preserves partial-update semantics — a missing key does not null out the field.

- [ ] **Step 4: Run tests**

Run: `./vendor/bin/sail artisan test --filter=TaskUpdateV2Test`
Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Api/TaskController.php tests/Feature/Api/TaskUpdateV2Test.php
git commit -m "feat(api): expand PATCH /api/tasks/{id} to accept title/priority/dates/project"
```

---

### Task A4: `CommentResource` + `POST /api/tasks/{task}/comments` — TDD

**Files:**
- Create: `app/Http/Resources/CommentResource.php`
- Create: `app/Http/Controllers/Api/CommentController.php`
- Modify: `routes/api.php`
- Create: `tests/Feature/Api/CommentApiTest.php`

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Api/CommentApiTest.php`:

```php
<?php

namespace Tests\Feature\Api;

use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CommentApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_create_comment_on_task(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($user);
        $task = Task::factory()->create();

        $res = $this->postJson("/api/tasks/{$task->id}/comments", [
            'content' => 'Looks good!',
        ]);

        $res->assertStatus(201)
            ->assertJsonStructure(['data' => ['id', 'content', 'user' => ['id', 'email'], 'created_at']]);
        $this->assertSame('Looks good!', $res->json('data.content'));
        $this->assertSame($user->id, $res->json('data.user.id'));
    }

    public function test_comment_stored_in_database(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($user);
        $task = Task::factory()->create();

        $this->postJson("/api/tasks/{$task->id}/comments", ['content' => 'Hello'])->assertStatus(201);

        $this->assertDatabaseHas('comments', [
            'content'          => 'Hello',
            'user_id'          => $user->id,
            'commentable_type' => Task::class,
            'commentable_id'   => $task->id,
        ]);
    }

    public function test_comment_requires_content(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $task = Task::factory()->create();

        $this->postJson("/api/tasks/{$task->id}/comments", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('content');
    }

    public function test_comment_requires_auth(): void
    {
        $task = Task::factory()->create();
        $this->postJson("/api/tasks/{$task->id}/comments", ['content' => 'Hi'])
            ->assertStatus(401);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./vendor/bin/sail artisan test --filter=CommentApiTest`
Expected: all FAIL.

- [ ] **Step 3: Create `CommentResource`**

Create `app/Http/Resources/CommentResource.php`:

```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class CommentResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'         => $this->id,
            'content'    => $this->content,
            'user'       => new UserResource($this->whenLoaded('user')),
            'created_at' => optional($this->created_at)->toIso8601String(),
        ];
    }
}
```

- [ ] **Step 4: Create `CommentController`**

Create `app/Http/Controllers/Api/CommentController.php`:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CommentResource;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommentController extends Controller
{
    public function storeForTask(Request $request, Task $task): JsonResponse
    {
        $data = $request->validate([
            'content' => ['required', 'string', 'max:5000'],
        ]);

        $comment = $task->addComment($data['content'], $request->user()->id);
        $comment->load('user');

        return (new CommentResource($comment))->response()->setStatusCode(201);
    }
}
```

- [ ] **Step 5: Add route**

In `routes/api.php`, inside the `auth:sanctum` + `throttle:api` group, add:

```php
use App\Http\Controllers\Api\CommentController;

Route::post('/tasks/{task}/comments', [CommentController::class, 'storeForTask']);
```

- [ ] **Step 6: Run tests**

Run: `./vendor/bin/sail artisan test --filter=CommentApiTest`
Expected: 4 passing.

- [ ] **Step 7: Commit**

```bash
git add app/Http/Resources/CommentResource.php app/Http/Controllers/Api/CommentController.php routes/api.php tests/Feature/Api/CommentApiTest.php
git commit -m "feat(api): add CommentResource and POST /api/tasks/{task}/comments"
```

---

## Part B — CLI

### Task B1: Add schemas for Comment and Project list

**Files:**
- Modify: `src/api/schemas.ts`

- [ ] **Step 1: Add `CommentSchema` and `ProjectListSchema` to `src/api/schemas.ts`**

Read `src/api/schemas.ts`. Append after `LoginResponseSchema`:

```ts
export const CommentSchema = z.object({
  id: z.number(),
  content: z.string(),
  user: UserSchema.nullable().optional(),
  created_at: z.string().nullable().optional(),
});
export type Comment = z.infer<typeof CommentSchema>;
```

`ProjectSchema` already exists — no change needed.

- [ ] **Step 2: Run typecheck**

```bash
cd /home/herwindo/dev/revvork/revvork-cli && npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/api/schemas.ts
git commit -m "feat(cli): add CommentSchema to schemas"
```

---

### Task B2: `ValidationError` + `suggestions.ts` — TDD

**Files:**
- Create: `src/errors/ValidationError.ts`
- Create: `src/errors/suggestions.ts`
- Create: `tests/errors/suggestions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/errors/suggestions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { suggest, COMMAND_PATHS } from '../../src/errors/suggestions.js';

describe('suggest', () => {
  it('returns undefined for an exact match', () => {
    expect(suggest('task list', COMMAND_PATHS)).toBeUndefined();
  });

  it('returns a suggestion for a close typo', () => {
    expect(suggest('taks list', COMMAND_PATHS)).toBe('task list');
  });

  it('returns a suggestion for single-char typo', () => {
    expect(suggest('whoam', COMMAND_PATHS)).toBe('whoami');
  });

  it('returns undefined when input is too far from any command', () => {
    expect(suggest('xyzabc', COMMAND_PATHS)).toBeUndefined();
  });

  it('is case-insensitive', () => {
    expect(suggest('TASK LIST', COMMAND_PATHS)).toBe('task list');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- suggestions
```
Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/errors/ValidationError.ts`**

```ts
export class ValidationError extends Error {
  constructor(message: string, public hint?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

- [ ] **Step 4: Create `src/errors/suggestions.ts`**

```ts
export const COMMAND_PATHS: string[] = [
  'login', 'logout', 'whoami',
  'task list', 'task show', 'task create', 'task update',
  'task done', 'task status', 'task comment',
  'user list',
  'report todo', 'report overdue', 'report assignee',
];

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1]
        ? dp[i - 1]![j - 1]!
        : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[m]![n]!;
}

export function suggest(input: string, candidates: string[]): string | undefined {
  const lower = input.toLowerCase();
  let best: string | undefined;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = levenshtein(lower, c.toLowerCase());
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return bestDist <= 3 && best !== lower ? best : undefined;
}
```

- [ ] **Step 5: Run tests**

```bash
npm test
```
Expected: 5 new suggestions tests pass, total 27 passing.

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/errors tests/errors
git commit -m "feat(cli): add ValidationError and command suggestion helper"
```

---

### Task B3: `resolve.ts` helpers — TDD

**Files:**
- Create: `src/api/resolve.ts`
- Create: `tests/api/resolve.test.ts`

These helpers resolve `--project <code>` → `project_id` and `--assignee <email>` → `assignee_id` by calling the API.

- [ ] **Step 1: Write the failing test**

Create `tests/api/resolve.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { ApiClient } from '../../src/api/client.js';
import { resolveProjectId, resolveAssigneeId } from '../../src/api/resolve.js';

let agent: MockAgent;
beforeEach(() => {
  agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
});
afterEach(async () => { await agent.close(); });

const client = () => new ApiClient({ baseUrl: 'http://api.test', token: 't' });

describe('resolveProjectId', () => {
  it('returns id for matching code', async () => {
    agent.get('http://api.test').intercept({ path: '/api/projects', method: 'GET' })
      .reply(200, { data: [{ id: 5, code: 'RVV', title: 'Revvork' }] });
    expect(await resolveProjectId(client(), 'RVV')).toBe(5);
  });

  it('throws ApiError 404 for unknown code', async () => {
    agent.get('http://api.test').intercept({ path: '/api/projects', method: 'GET' })
      .reply(200, { data: [] });
    const { ApiError } = await import('../../src/api/errors.js');
    await expect(resolveProjectId(client(), 'XXX')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('resolveAssigneeId', () => {
  it('returns id for matching email', async () => {
    agent.get('http://api.test').intercept({ path: '/api/users', method: 'GET' })
      .reply(200, { data: [{ id: 3, email: 'budi@co.com', name: 'Budi', role: 'user' }] });
    expect(await resolveAssigneeId(client(), 'budi@co.com')).toBe(3);
  });

  it('returns numeric id directly without API call', async () => {
    expect(await resolveAssigneeId(client(), '7')).toBe(7);
  });

  it('throws ApiError 404 for unknown email', async () => {
    agent.get('http://api.test').intercept({ path: '/api/users', method: 'GET' })
      .reply(200, { data: [] });
    const { ApiError } = await import('../../src/api/errors.js');
    await expect(resolveAssigneeId(client(), 'ghost@co.com')).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- resolve
```

- [ ] **Step 3: Create `src/api/resolve.ts`**

```ts
import { ApiClient } from './client.js';
import { ApiError } from './errors.js';
import { ListEnvelope, ProjectSchema, UserSchema } from './schemas.js';

export async function resolveProjectId(client: ApiClient, code: string): Promise<number> {
  const raw = await client.get('/api/projects');
  const { data } = ListEnvelope(ProjectSchema).parse(raw);
  const project = data.find((p) => p.code?.toLowerCase() === code.toLowerCase());
  if (!project) throw new ApiError(404, `Project not found: ${code}`);
  return project.id;
}

export async function resolveAssigneeId(client: ApiClient, assignee: string): Promise<number> {
  if (/^\d+$/.test(assignee)) return Number(assignee);
  const raw = await client.get('/api/users');
  const { data } = ListEnvelope(UserSchema).parse(raw);
  const user = data.find((u) => u.email.toLowerCase() === assignee.toLowerCase());
  if (!user) throw new ApiError(404, `User not found: ${assignee}`);
  return user.id;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: 5 new resolve tests pass, total 32 passing.

- [ ] **Step 5: Commit**

```bash
git add src/api/resolve.ts tests/api/resolve.test.ts
git commit -m "feat(cli): add resolveProjectId and resolveAssigneeId helpers"
```

---

### Task B4: `task create`, `task update`, `task comment` commands — TDD

**Files:**
- Modify: `src/commands/task.ts`
- Modify: `tests/commands/task.test.ts`

- [ ] **Step 1: Write the failing tests**

Read `tests/commands/task.test.ts`. Append these new describe blocks after the existing ones:

```ts
import { runTaskCreate, runTaskEdit, runTaskComment } from '../../src/commands/task.js';
// Add to existing imports at top of file

describe('task create', () => {
  it('POSTs to /api/tasks and prints JSON', async () => {
    agent.get('http://api.test').intercept({ path: '/api/projects', method: 'GET' })
      .reply(200, { data: [{ id: 1, code: 'RVV', title: 'Revvork' }] });
    agent.get('http://api.test').intercept({ path: '/api/tasks', method: 'POST' })
      .reply(201, { data: { id: 10, title: 'New task', status: 'Backlog', priority: 'Medium' } });

    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await runTaskCreate({ profile: 'default', json: true, title: 'New task', project: 'RVV', assignee: undefined, priority: undefined, status: undefined, start: undefined, due: undefined });
    expect(spy.mock.calls.flat().join('')).toContain('"id": 10');
    spy.mockRestore();
  });

  it('throws ValidationError for invalid priority', async () => {
    const { ValidationError } = await import('../../src/errors/ValidationError.js');
    await expect(runTaskCreate({ profile: 'default', json: false, title: 'T', project: undefined, assignee: undefined, priority: 'Extreme', status: undefined, start: undefined, due: undefined }))
      .rejects.toBeInstanceOf(ValidationError);
  });
});

describe('task edit (update)', () => {
  it('PATCHes task with title', async () => {
    agent.get('http://api.test').intercept({ path: '/api/tasks/5', method: 'PATCH' })
      .reply(200, { data: { id: 5, title: 'Updated', status: 'To Do' } });

    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await runTaskEdit({ profile: 'default', json: true, id: 5, title: 'Updated', priority: undefined, assignee: undefined, project: undefined, start: undefined, due: undefined });
    expect(spy.mock.calls.flat().join('')).toContain('"id": 5');
    spy.mockRestore();
  });

  it('exits with error when no flags provided', async () => {
    await expect(runTaskEdit({ profile: 'default', json: false, id: 5, title: undefined, priority: undefined, assignee: undefined, project: undefined, start: undefined, due: undefined }))
      .rejects.toThrow('Nothing to update');
  });
});

describe('task comment', () => {
  it('POSTs comment and prints success', async () => {
    agent.get('http://api.test').intercept({ path: '/api/tasks/7/comments', method: 'POST' })
      .reply(201, { data: { id: 1, content: 'Nice work', user: { id: 1, email: 'a@b', name: 'A' }, created_at: '2026-04-28T00:00:00Z' } });

    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await runTaskComment({ profile: 'default', json: false, id: 7, content: 'Nice work' });
    expect(spy.mock.calls.flat().join('')).toContain('Comment added');
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to verify new ones fail**

```bash
npm test -- task
```

- [ ] **Step 3: Add `runTaskCreate`, `runTaskEdit`, `runTaskComment` to `src/commands/task.ts`**

Read `src/commands/task.ts`. Append after `runTaskUpdate`:

```ts
import { resolveProjectId, resolveAssigneeId } from '../api/resolve.js';
import { CommentSchema, ItemEnvelope as IE } from '../api/schemas.js';
import { ValidationError } from '../errors/ValidationError.js';

const VALID_PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'];

export type TaskCreateOpts = {
  profile: string; json: boolean;
  title: string;
  project?: string; assignee?: string; priority?: string; status?: string;
  start?: string; due?: string;
};

export async function runTaskCreate(opts: TaskCreateOpts): Promise<void> {
  if (opts.priority && !VALID_PRIORITIES.includes(opts.priority)) {
    throw new ValidationError(
      `Invalid priority: "${opts.priority}"`,
      `Valid values: ${VALID_PRIORITIES.join(', ')}`,
    );
  }
  const client = clientFor(opts.profile);
  const body: Record<string, unknown> = { title: opts.title };
  if (opts.status)   body.status = opts.status;
  if (opts.priority) body.priority = opts.priority;
  if (opts.start)    body.start_date = opts.start;
  if (opts.due)      body.due_date = opts.due;
  if (opts.project)  body.project_id = await resolveProjectId(client, opts.project);
  if (opts.assignee) body.assignee_id = await resolveAssigneeId(client, opts.assignee);

  const raw = await client.post('/api/tasks', body);
  const { data: t } = ItemEnvelope(TaskSchema).parse(raw);
  if (opts.json) { printJson(t); return; }
  success(`Task #${t.id} created: ${t.title ?? '—'}`);
}

export type TaskEditOpts = {
  profile: string; json: boolean; id: number;
  title?: string; priority?: string; assignee?: string; project?: string;
  start?: string; due?: string;
};

export async function runTaskEdit(opts: TaskEditOpts): Promise<void> {
  if (opts.priority && !VALID_PRIORITIES.includes(opts.priority)) {
    throw new ValidationError(
      `Invalid priority: "${opts.priority}"`,
      `Valid values: ${VALID_PRIORITIES.join(', ')}`,
    );
  }
  const body: Record<string, unknown> = {};
  if (opts.title)  body.title = opts.title;
  if (opts.priority) body.priority = opts.priority;
  if (opts.start)  body.start_date = opts.start;
  if (opts.due)    body.due_date = opts.due;

  const client = clientFor(opts.profile);
  if (opts.project)  body.project_id = await resolveProjectId(client, opts.project);
  if (opts.assignee) body.assignee_id = await resolveAssigneeId(client, opts.assignee);

  if (Object.keys(body).length === 0) throw new Error('Nothing to update. Provide at least one flag.');

  const raw = await client.patch(`/api/tasks/${opts.id}`, body);
  const { data: t } = ItemEnvelope(TaskSchema).parse(raw);
  if (opts.json) { printJson(t); return; }
  success(`Task #${t.id} updated`);
}

export type TaskCommentOpts = { profile: string; json: boolean; id: number; content: string };

export async function runTaskComment(opts: TaskCommentOpts): Promise<void> {
  const client = clientFor(opts.profile);
  const raw = await client.post(`/api/tasks/${opts.id}/comments`, { content: opts.content });
  const { data: c } = IE(CommentSchema).parse(raw);
  if (opts.json) { printJson(c); return; }
  success(`Comment added to task #${opts.id}`);
}
```

Also add the import at the top of `src/commands/task.ts` — the `ItemEnvelope` is already imported as `ItemEnvelope`; add `CommentSchema` to the schemas import line:

```ts
import { ItemEnvelope, ListEnvelope, TaskSchema, CommentSchema } from '../api/schemas.js';
import { resolveProjectId, resolveAssigneeId } from '../api/resolve.js';
import { ValidationError } from '../errors/ValidationError.js';
```

And remove the alias `IE` — use `ItemEnvelope` consistently:

```ts
const { data: c } = ItemEnvelope(CommentSchema).parse(raw);
```

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: all new task tests pass, total ~37 passing.

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/commands/task.ts tests/commands/task.test.ts
git commit -m "feat(cli): add task create, task update (full), task comment commands"
```

---

### Task B5: Report commands — TDD

**Files:**
- Create: `src/commands/report.ts`
- Create: `tests/commands/report.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/commands/report.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveProfile } from '../../src/config/profile.js';
import { runReportTodo, runReportOverdue, runReportAssignee } from '../../src/commands/report.js';

let agent: MockAgent;
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'revvork-'));
  process.env.REVVORK_CONFIG_DIR = dir;
  agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  saveProfile('default', { baseUrl: 'http://api.test', token: 'tok', email: 'a@b' });
});
afterEach(async () => {
  await agent.close();
  rmSync(dir, { recursive: true, force: true });
  delete process.env.REVVORK_CONFIG_DIR;
});

describe('report todo', () => {
  it('lists To Do tasks for a project as JSON', async () => {
    agent.get('http://api.test')
      .intercept({ path: '/api/tasks?status=To+Do&project=RVV&assignee=all', method: 'GET' })
      .reply(200, { data: [{ id: 1, title: 'A', status: 'To Do', priority: 'High' }] });

    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await runReportTodo({ profile: 'default', json: true, project: 'RVV', assignee: undefined });
    expect(spy.mock.calls.flat().join('')).toContain('"id": 1');
    spy.mockRestore();
  });

  it('throws when --project is missing', async () => {
    await expect(runReportTodo({ profile: 'default', json: false, project: undefined, assignee: undefined }))
      .rejects.toThrow('--project is required');
  });
});

describe('report overdue', () => {
  it('filters out tasks with due_date in the future', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]!;
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]!;
    agent.get('http://api.test')
      .intercept({ path: '/api/tasks?status=Backlog%2CTo+Do%2CIn+Progress%2CIn+Review&assignee=all&limit=200', method: 'GET' })
      .reply(200, {
        data: [
          { id: 1, title: 'Overdue', status: 'In Progress', due_date: yesterday },
          { id: 2, title: 'Future', status: 'To Do', due_date: tomorrow },
          { id: 3, title: 'No due', status: 'To Do', due_date: null },
        ],
      });

    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await runReportOverdue({ profile: 'default', json: true, project: undefined, assignee: undefined });
    const out = spy.mock.calls.flat().join('');
    expect(out).toContain('"id": 1');
    expect(out).not.toContain('"id": 2');
    expect(out).not.toContain('"id": 3');
    spy.mockRestore();
  });
});

describe('report assignee', () => {
  it('groups tasks by assignee email', async () => {
    agent.get('http://api.test')
      .intercept({ path: '/api/tasks?status=Backlog%2CTo+Do%2CIn+Progress%2CIn+Review&assignee=all&limit=200', method: 'GET' })
      .reply(200, {
        data: [
          { id: 1, status: 'In Progress', assignee: { id: 1, email: 'a@b', name: 'A' } },
          { id: 2, status: 'To Do',       assignee: { id: 1, email: 'a@b', name: 'A' } },
          { id: 3, status: 'In Progress', assignee: { id: 2, email: 'c@d', name: 'C' } },
        ],
      });

    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await runReportAssignee({ profile: 'default', json: true, project: undefined });
    const out = JSON.parse(spy.mock.calls.flat().join('').trim());
    const aRow = out.find((r: { assignee: { email: string } }) => r.assignee.email === 'a@b');
    expect(aRow.total).toBe(2);
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- report
```

- [ ] **Step 3: Create `src/commands/report.ts`**

```ts
import { ApiClient } from '../api/client.js';
import { ApiError } from '../api/errors.js';
import { ListEnvelope, TaskSchema } from '../api/schemas.js';
import { getActiveProfile } from '../config/profile.js';
import { printTable } from '../output/table.js';
import { printJson } from '../output/json.js';

const ACTIVE_STATUSES = 'Backlog,To Do,In Progress,In Review';

function clientFor(profile: string): ApiClient {
  const p = getActiveProfile(profile);
  if (!p?.token) throw new ApiError(401, 'Not logged in. Run: revvork login');
  return new ApiClient({ baseUrl: p.baseUrl, token: p.token });
}

export type ReportTodoOpts = { profile: string; json: boolean; project?: string; assignee?: string };

export async function runReportTodo(opts: ReportTodoOpts): Promise<void> {
  if (!opts.project) throw new Error('--project is required for this report.');
  const client = clientFor(opts.profile);
  const raw = await client.get('/api/tasks', {
    status: 'To Do',
    project: opts.project,
    assignee: opts.assignee ?? 'all',
  });
  const { data } = ListEnvelope(TaskSchema).parse(raw);
  if (opts.json) { printJson(data); return; }
  if (data.length === 0) { process.stdout.write('No To Do tasks found.\n'); return; }
  printTable(
    ['ID', 'Title', 'Priority', 'Assignee', 'Due'],
    data.map((t) => [t.id, t.title ?? null, t.priority ?? null, t.assignee?.email ?? null, t.due_date ?? null]),
  );
}

export type ReportOverdueOpts = { profile: string; json: boolean; project?: string; assignee?: string };

export async function runReportOverdue(opts: ReportOverdueOpts): Promise<void> {
  const client = clientFor(opts.profile);
  const today = new Date().toISOString().split('T')[0]!;
  const raw = await client.get('/api/tasks', {
    status: ACTIVE_STATUSES,
    assignee: opts.assignee ?? 'all',
    project: opts.project,
    limit: '200',
  });
  const { data } = ListEnvelope(TaskSchema).parse(raw);
  const overdue = data.filter((t) => t.due_date && t.due_date < today);

  if (opts.json) {
    printJson(overdue.map((t) => ({
      ...t,
      days_overdue: Math.floor((Date.now() - new Date(t.due_date!).getTime()) / 86400000),
    })));
    return;
  }
  if (overdue.length === 0) { process.stdout.write('No overdue tasks.\n'); return; }
  printTable(
    ['ID', 'Title', 'Status', 'Priority', 'Assignee', 'Project', 'Due', 'Days overdue'],
    overdue.map((t) => [
      t.id, t.title ?? null, t.status ?? null, t.priority ?? null,
      t.assignee?.email ?? null, t.project?.code ?? null, t.due_date ?? null,
      Math.floor((Date.now() - new Date(t.due_date!).getTime()) / 86400000),
    ]),
  );
}

export type ReportAssigneeOpts = { profile: string; json: boolean; project?: string };

export async function runReportAssignee(opts: ReportAssigneeOpts): Promise<void> {
  const client = clientFor(opts.profile);
  const raw = await client.get('/api/tasks', {
    status: ACTIVE_STATUSES,
    assignee: 'all',
    project: opts.project,
    limit: '200',
  });
  const { data } = ListEnvelope(TaskSchema).parse(raw);

  const map = new Map<string, { assignee: { id: number; email: string }; counts: Record<string, number>; total: number }>();
  for (const t of data) {
    const email = t.assignee?.email ?? '(unassigned)';
    const id = t.assignee?.id ?? 0;
    if (!map.has(email)) map.set(email, { assignee: { id, email }, counts: {}, total: 0 });
    const row = map.get(email)!;
    const s = t.status ?? 'Unknown';
    row.counts[s] = (row.counts[s] ?? 0) + 1;
    row.total++;
  }

  const rows = [...map.values()].sort((a, b) => b.total - a.total);
  if (opts.json) { printJson(rows); return; }
  if (rows.length === 0) { process.stdout.write('No active tasks found.\n'); return; }

  const statuses = [...new Set(data.map((t) => t.status ?? 'Unknown'))];
  printTable(
    ['Assignee', ...statuses, 'Total'],
    rows.map((r) => [r.assignee.email, ...statuses.map((s) => r.counts[s] ?? 0), r.total]),
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: all report tests pass.

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/commands/report.ts tests/commands/report.test.ts
git commit -m "feat(cli): add report todo/overdue/assignee commands"
```

---

### Task B6: Wire everything into `src/index.ts` + commander error feedback

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Replace `src/index.ts` entirely with the following**

```ts
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

// ── Auth ────────────────────────────────────────────────────────────────────

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

// ── Tasks ───────────────────────────────────────────────────────────────────

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

// ── Users ────────────────────────────────────────────────────────────────────

const user = program.command('user').description('Manage users').exitOverride();
user.command('list').exitOverride().action(async (_o, cmd) => {
  const g = cmd.optsWithGlobals();
  await runUserList({ profile: g.profile as string, json: g.json as boolean });
});

// ── Reports ──────────────────────────────────────────────────────────────────

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

// ── Error handling ───────────────────────────────────────────────────────────

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
```

- [ ] **Step 2: Run full test suite**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Build and verify help output**

```bash
npm run build
node dist/index.cjs --help
node dist/index.cjs task --help
node dist/index.cjs report --help
```

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat(cli): wire task create/update/comment, report commands, and error feedback"
```

---

### Task B7: Version bump + README update

**Files:**
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Bump version in `package.json`**

Change `"version": "0.1.0"` to `"version": "0.2.0"`.

- [ ] **Step 2: Update `README.md`**

Add the following sections after the existing `### \`revvork user list\`` section:

````markdown
### `revvork task create`

Create a new task. `--title` is required.

```bash
revvork task create --title "Fix auth redirect" \
  --project RVV \
  --assignee budi@company.com \
  --priority High \
  --status "To Do" \
  --due 2026-05-15
```

### `revvork task update <id>`

Update task fields. At least one flag required. Does not change status — use `task status` or `task done` for that.

```bash
revvork task update 123 --title "Updated title"
revvork task update 123 --priority Urgent --due 2026-05-01
revvork task update 123 --assignee budi@company.com
```

### `revvork task comment <id> <content>`

Add a comment to a task.

```bash
revvork task comment 123 "Deployed to staging, please verify."
```

### `revvork report todo --project <code>`

List all To Do tasks for a project.

```bash
revvork report todo --project RVV
revvork report todo --project RVV --assignee budi@company.com
```

Output columns: `ID · Title · Priority · Assignee · Due`

### `revvork report overdue`

List active tasks past their due date.

```bash
revvork report overdue
revvork report overdue --project RVV
```

Output columns: `ID · Title · Status · Priority · Assignee · Project · Due · Days overdue`

### `revvork report assignee`

Show task count per person per status.

```bash
revvork report assignee
revvork report assignee --project RVV
```
````

Also update the version badge / description at the top to mention v0.2.0 features.

- [ ] **Step 3: Build**

```bash
npm run build
node dist/index.cjs --version
```
Expected: `0.2.0`

- [ ] **Step 4: Commit and push**

```bash
git add package.json README.md
git commit -m "chore: bump to v0.2.0, update README with new commands"
git push origin main
```

---

## Self-Review

**1. Spec coverage:**
- `GET /api/projects` → Task A1 ✓
- `POST /api/tasks` → Task A2 ✓
- Expand `PATCH /api/tasks/{id}` → Task A3 ✓
- `POST /api/tasks/{task}/comments` + `CommentResource` → Task A4 ✓
- `CommentSchema` → Task B1 ✓
- `ValidationError` + `suggestions.ts` → Task B2 ✓
- `resolveProjectId` / `resolveAssigneeId` → Task B3 ✓
- `runTaskCreate`, `runTaskEdit`, `runTaskComment` → Task B4 ✓
- `runReportTodo`, `runReportOverdue`, `runReportAssignee` → Task B5 ✓
- Commander error feedback (unknown command, missing arg, invalid enum) → Task B6 ✓
- Version bump 0.2.0 → Task B7 ✓

**2. Placeholder scan:** None found.

**3. Type consistency:**
- `runTaskEdit` defined in B4, imported in B6 as `runTaskEdit` ✓
- `runTaskCreate` defined in B4, imported in B6 as `runTaskCreate` ✓
- `runTaskComment` defined in B4, imported in B6 as `runTaskComment` ✓
- `ValidationError` defined in B2, used in B4 and B6 ✓
- `CommentSchema` added in B1, consumed in B4 ✓
- `resolveProjectId`/`resolveAssigneeId` defined in B3, used in B4 ✓
- `COMMAND_PATHS` defined in B2, used in B6 ✓
