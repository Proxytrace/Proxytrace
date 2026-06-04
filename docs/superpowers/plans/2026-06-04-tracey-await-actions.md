# Tracey `await_actions` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Tracey react to long-running actions (test runs, optimization theories) in the same turn, by giving her a generic `await_actions` tool that waits for them to reach a terminal state and returns the aggregate result.

**Architecture:** Pull, not push. Tracey calls `await_actions([handles])`; the tool polls each action's API until terminal (or a 10-minute cap), then returns a compact aggregate she reasons on — all in one assistant turn. No card→thread coupling, no coordinator. The two producing tools (`start_test_run`, `submit_optimization_theory`) each return an `awaitable: { kind, id }` handle she collects and passes in.

**Tech Stack:** React 19 / TypeScript, Vercel AI SDK v6 (Tracey tools as zod schema + `execute`), Vitest. Frontend only — no backend change (Tracey tools live only on the client; attribution is by name).

**Spec:** `docs/superpowers/specs/2026-06-04-tracey-proactive-await-actions-design.md`

---

## File Structure

**New**
- `frontend/src/features/tracey/tools/poll-until-terminal.ts` — pure poll loop with injectable timers. One responsibility: "call `poll` until `isTerminal` or timeout".
- `frontend/src/features/tracey/tools/poll-until-terminal.spec.ts` — its unit tests.
- `frontend/src/features/tracey/tools/await.ts` — `createAwaitTools` factory (the `await_actions` tool), the two terminal predicates, the two summarizers, and the per-kind dispatch (`awaitOne`).
- `frontend/src/features/tracey/tools/await.spec.ts` — predicate units + tool happy-path aggregate.

**Modified**
- `frontend/src/features/tracey/tracey-tools.ts` — wire `createAwaitTools`; add `await_actions` to `TRACEY_TOOLS_META`.
- `frontend/src/features/tracey/tools/runs.ts` — `start_test_run` summary gains `awaitable`.
- `frontend/src/features/tracey/tools/proposals.ts` — `submit_optimization_theory` success return gains `awaitable`.
- `frontend/src/features/tracey/tracey-tools.spec.ts` — update the two producer assertions.
- `frontend/src/features/tracey/skills/suites-runs-skill.md` — await-after-start playbook.
- `frontend/src/features/tracey/skills/optimization-skill.md` — await-the-theory playbook.
- `frontend/src/features/tracey/TRACEY.md` — document the await tool.
- `manual/guide/tracey.md` — user-facing note.

All commands below run from `frontend/` unless stated otherwise.

---

## Task 1: Pure poll-until-terminal helper

**Files:**
- Create: `frontend/src/features/tracey/tools/poll-until-terminal.ts`
- Test: `frontend/src/features/tracey/tools/poll-until-terminal.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/tracey/tools/poll-until-terminal.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { pollUntilTerminal } from './poll-until-terminal';

/** A fake clock whose `sleep` advances `now` instantly, so tests never really wait. */
function fakeClock() {
  let t = 0;
  return {
    now: () => t,
    sleep: vi.fn((ms: number) => {
      t += ms;
      return Promise.resolve();
    }),
  };
}

describe('pollUntilTerminal', () => {
  it('returns immediately when the first snapshot is terminal', async () => {
    const clock = fakeClock();
    const poll = vi.fn().mockResolvedValue({ done: true });
    const res = await pollUntilTerminal(poll, (s: { done: boolean }) => s.done, {
      intervalMs: 3000, timeoutMs: 60000, ...clock,
    });
    expect(res).toEqual({ snapshot: { done: true }, timedOut: false });
    expect(poll).toHaveBeenCalledTimes(1);
    expect(clock.sleep).not.toHaveBeenCalled();
  });

  it('polls until a snapshot is terminal', async () => {
    const clock = fakeClock();
    const poll = vi
      .fn()
      .mockResolvedValueOnce({ done: false })
      .mockResolvedValueOnce({ done: false })
      .mockResolvedValueOnce({ done: true });
    const res = await pollUntilTerminal(poll, (s: { done: boolean }) => s.done, {
      intervalMs: 3000, timeoutMs: 60000, ...clock,
    });
    expect(res.timedOut).toBe(false);
    expect(res.snapshot).toEqual({ done: true });
    expect(poll).toHaveBeenCalledTimes(3);
    expect(clock.sleep).toHaveBeenCalledTimes(2);
  });

  it('gives up with timedOut once the cap is exceeded', async () => {
    const clock = fakeClock();
    const poll = vi.fn().mockResolvedValue({ done: false });
    const res = await pollUntilTerminal(poll, (s: { done: boolean }) => s.done, {
      intervalMs: 3000, timeoutMs: 9000, ...clock,
    });
    expect(res.timedOut).toBe(true);
    expect(res.snapshot).toEqual({ done: false });
    // start 0 → poll → sleep(3000)=3000 → poll → sleep=6000 → poll → sleep=9000 → poll → 9000>=9000 stop
    expect(poll.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/tracey/tools/poll-until-terminal.spec.ts`
Expected: FAIL — `Failed to resolve import "./poll-until-terminal"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/features/tracey/tools/poll-until-terminal.ts`:

```ts
// Pure poll loop with injectable timers — no React, no globals — so it is unit-testable
// without real delays. Calls `poll` until `isTerminal` holds or `timeoutMs` elapses; on
// timeout it returns the last snapshot with `timedOut: true` rather than throwing.

export interface PollOptions {
  /** Delay between polls, in ms. */
  intervalMs: number;
  /** Overall cap, in ms. After this elapses the loop gives up with `timedOut: true`. */
  timeoutMs: number;
  /** Sleeps for `ms` (injected so tests can advance a fake clock instantly). */
  sleep: (ms: number) => Promise<void>;
  /** Current time in ms (injected for the same reason). */
  now: () => number;
}

export async function pollUntilTerminal<S>(
  poll: () => Promise<S>,
  isTerminal: (snapshot: S) => boolean,
  opts: PollOptions,
): Promise<{ snapshot: S; timedOut: boolean }> {
  const start = opts.now();
  let snapshot = await poll();
  while (!isTerminal(snapshot)) {
    if (opts.now() - start >= opts.timeoutMs) return { snapshot, timedOut: true };
    await opts.sleep(opts.intervalMs);
    snapshot = await poll();
  }
  return { snapshot, timedOut: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/tracey/tools/poll-until-terminal.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /home/daniel/Proxytrace
git add frontend/src/features/tracey/tools/poll-until-terminal.ts frontend/src/features/tracey/tools/poll-until-terminal.spec.ts
git commit -m "feat(tracey): add pure pollUntilTerminal helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: The `await_actions` tool + awaitable registry

**Files:**
- Create: `frontend/src/features/tracey/tools/await.ts`
- Test: `frontend/src/features/tracey/tools/await.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/tracey/tools/await.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestRunStatus, TheoryStatus } from '../../../api/models';

const { testRunGroupsApi, theoriesApi } = vi.hoisted(() => ({
  testRunGroupsApi: { get: vi.fn() },
  theoriesApi: { get: vi.fn() },
}));
vi.mock('../../../api/test-run-groups', () => ({ testRunGroupsApi }));
vi.mock('../../../api/theories', () => ({ theoriesApi }));

import { createAwaitTools, isRunTerminal, isTheoryTerminal } from './await';
import type { TraceyToolContext } from './shared';

const ctx: TraceyToolContext = {
  projectId: 'p1', artifactScope: 'u:p', navigate: vi.fn(), confirm: vi.fn(),
};
const store = vi.fn();

describe('terminal predicates', () => {
  it('treats Completed/Failed/Cancelled runs as terminal, Running/Pending as not', () => {
    expect(isRunTerminal(TestRunStatus.Completed)).toBe(true);
    expect(isRunTerminal(TestRunStatus.Failed)).toBe(true);
    expect(isRunTerminal(TestRunStatus.Cancelled)).toBe(true);
    expect(isRunTerminal(TestRunStatus.Running)).toBe(false);
    expect(isRunTerminal(TestRunStatus.Pending)).toBe(false);
  });

  it('treats Validated/Invalidated theories as terminal, Proposed/Validating as not', () => {
    expect(isTheoryTerminal(TheoryStatus.Validated)).toBe(true);
    expect(isTheoryTerminal(TheoryStatus.Invalidated)).toBe(true);
    expect(isTheoryTerminal(TheoryStatus.Proposed)).toBe(false);
    expect(isTheoryTerminal(TheoryStatus.Validating)).toBe(false);
  });
});

describe('await_actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('aggregates a mixed batch of already-terminal handles', async () => {
    testRunGroupsApi.get.mockResolvedValue({
      id: 'g1', suiteName: 'Suite', agentName: 'A', status: TestRunStatus.Completed,
      runs: [{ agentName: 'A', status: TestRunStatus.Completed, passedCases: 7, failedCases: 3, totalCases: 10, passRate: 70 }],
    });
    theoriesApi.get.mockResolvedValue({
      id: 't1', agentName: 'A', status: TheoryStatus.Validated, resultingProposalId: 'pr1',
    });

    const tool = createAwaitTools(ctx, store).await_actions;
    const result = await tool.execute!(
      { handles: [{ kind: 'test-run', id: 'g1' }, { kind: 'theory', id: 't1' }] },
      ctx,
    ) as { anyTimedOut: boolean; results: { kind: string; id: string; status: string; timedOut: boolean }[] };

    expect(result.anyTimedOut).toBe(false);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toMatchObject({ kind: 'test-run', id: 'g1', status: TestRunStatus.Completed, timedOut: false });
    expect(result.results[1]).toMatchObject({ kind: 'theory', id: 't1', status: TheoryStatus.Validated, timedOut: false });
    expect(testRunGroupsApi.get).toHaveBeenCalledWith('g1');
    expect(theoriesApi.get).toHaveBeenCalledWith('t1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/tracey/tools/await.spec.ts`
Expected: FAIL — `Failed to resolve import "./await"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/features/tracey/tools/await.ts`:

```ts
import { z } from 'zod';
import { testRunGroupsApi } from '../../../api/test-run-groups';
import { theoriesApi } from '../../../api/theories';
import { TestRunStatus, TheoryStatus, type TestRunGroupDto, type TheoryDto } from '../../../api/models';
import { type ToolFactory, tool } from './shared';
import { pollUntilTerminal, type PollOptions } from './poll-until-terminal';

/** How often a pending action is polled while waiting. */
const POLL_INTERVAL_MS = 3_000;
/** Hard cap on a single wait. Generous for real suites; a slow action returns `timedOut: true`. */
const AWAIT_ACTIONS_TIMEOUT_MS = 10 * 60 * 1_000;

const TERMINAL_RUN: ReadonlySet<TestRunStatus> = new Set([
  TestRunStatus.Completed,
  TestRunStatus.Failed,
  TestRunStatus.Cancelled,
]);
const TERMINAL_THEORY: ReadonlySet<TheoryStatus> = new Set([
  TheoryStatus.Validated,
  TheoryStatus.Invalidated,
]);

export const isRunTerminal = (status: TestRunStatus): boolean => TERMINAL_RUN.has(status);
export const isTheoryTerminal = (status: TheoryStatus): boolean => TERMINAL_THEORY.has(status);

/** The kinds of long-running action Tracey can wait on. */
export type AwaitKind = 'test-run' | 'theory';

/** Compact, model-facing result for one awaited handle. */
export interface AwaitResult {
  kind: AwaitKind;
  id: string;
  status: TestRunStatus | TheoryStatus;
  timedOut: boolean;
}

interface RunAwaitResult extends AwaitResult {
  kind: 'test-run';
  status: TestRunStatus;
  suiteName: string;
  agentName: string;
  runs: { agentName: string; status: TestRunStatus; passed: number; failed: number; total: number; passRate: number }[];
}

interface TheoryAwaitResult extends AwaitResult {
  kind: 'theory';
  status: TheoryStatus;
  agentName: string;
  resultingProposalId: string | null;
}

function summarizeRun(group: TestRunGroupDto, timedOut: boolean): RunAwaitResult {
  return {
    kind: 'test-run',
    id: group.id,
    status: group.status,
    timedOut,
    suiteName: group.suiteName,
    agentName: group.agentName,
    runs: group.runs.map((run) => ({
      agentName: run.agentName,
      status: run.status,
      passed: run.passedCases,
      failed: run.failedCases,
      total: run.totalCases,
      passRate: run.passRate,
    })),
  };
}

function summarizeTheory(theory: TheoryDto, timedOut: boolean): TheoryAwaitResult {
  return {
    kind: 'theory',
    id: theory.id,
    status: theory.status,
    timedOut,
    agentName: theory.agentName,
    resultingProposalId: theory.resultingProposalId,
  };
}

/** Waits on a single handle, dispatching to the right API + terminal predicate by kind. */
async function awaitOne(handle: { kind: AwaitKind; id: string }, opts: PollOptions): Promise<AwaitResult> {
  if (handle.kind === 'test-run') {
    const { snapshot, timedOut } = await pollUntilTerminal(
      () => testRunGroupsApi.get(handle.id),
      (g) => isRunTerminal(g.status),
      opts,
    );
    return summarizeRun(snapshot, timedOut);
  }
  const { snapshot, timedOut } = await pollUntilTerminal(
    () => theoriesApi.get(handle.id),
    (t) => isTheoryTerminal(t.status),
    opts,
  );
  return summarizeTheory(snapshot, timedOut);
}

const handleSchema = z.object({
  kind: z.enum(['test-run', 'theory']).describe('The kind of action: "test-run" or "theory".'),
  id: z.string().describe('The action id from the `awaitable` handle of the producing tool.'),
});

/**
 * Tracey's wait tool. Resolves once every handed-in action reaches a terminal state (or the
 * per-handle cap is hit), then returns one aggregate so Tracey can react in the same turn.
 */
export const createAwaitTools: ToolFactory = () => ({
  await_actions: tool({
    description:
      'Wait for one or more long-running actions to finish, then return their results so you can ' +
      'react in the same turn. Pass the `awaitable` handle returned by start_test_run or ' +
      'submit_optimization_theory. Start ALL the actions first, then call this ONCE with every ' +
      'handle — do not call it per action and do not poll yourself.',
    parameters: z.object({
      handles: z.array(handleSchema).min(1).describe('The actions to wait for.'),
    }),
    confirm: false,
    execute: async ({ handles }) => {
      const opts: PollOptions = {
        intervalMs: POLL_INTERVAL_MS,
        timeoutMs: AWAIT_ACTIONS_TIMEOUT_MS,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        now: () => Date.now(),
      };
      const results = await Promise.all(handles.map((handle) => awaitOne(handle, opts)));
      return { results, anyTimedOut: results.some((r) => r.timedOut) };
    },
  }),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/tracey/tools/await.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /home/daniel/Proxytrace
git add frontend/src/features/tracey/tools/await.ts frontend/src/features/tracey/tools/await.spec.ts
git commit -m "feat(tracey): add await_actions tool + awaitable registry

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Wire `await_actions` into the tool set

**Files:**
- Modify: `frontend/src/features/tracey/tracey-tools.ts`

- [ ] **Step 1: Add the import**

In `frontend/src/features/tracey/tracey-tools.ts`, add the import after the `createDisplayTools` import (line 10):

```ts
import { createDisplayTools } from './tools/display';
import { createAwaitTools } from './tools/await';
```

- [ ] **Step 2: Spread the factory into `createTraceyTools`**

In the returned object of `createTraceyTools`, add `createAwaitTools` after `createDisplayTools`:

```ts
    ...createDisplayTools(ctx, store),
    ...createAwaitTools(ctx, store),
  };
```

- [ ] **Step 3: Add the slash-menu metadata entry**

In `TRACEY_TOOLS_META`, add this entry right after the `submit_optimization_theory` entry:

```ts
  { name: 'submit_optimization_theory', description: 'Theorize an agent optimization and A/B-test it (confirm).' },
  { name: 'await_actions', description: 'Wait for test runs / theories to finish, then react.' },
```

- [ ] **Step 4: Verify the tool set wires up**

Run: `npx vitest run src/features/tracey`
Expected: PASS — all existing tracey specs still green (no behavior changed yet for producers).

- [ ] **Step 5: Commit**

```bash
cd /home/daniel/Proxytrace
git add frontend/src/features/tracey/tracey-tools.ts
git commit -m "feat(tracey): register await_actions in the tool set

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `start_test_run` returns an awaitable handle

**Files:**
- Modify: `frontend/src/features/tracey/tools/runs.ts`
- Test: `frontend/src/features/tracey/tracey-tools.spec.ts:128`

- [ ] **Step 1: Update the failing test**

In `frontend/src/features/tracey/tracey-tools.spec.ts`, in the test `start_test_run fires the run and stores the group, returning a compact summary`, change the summary assertion to include the handle. Replace:

```ts
    expect(result.summary).toEqual({ id: 'g1', suiteName: 'Suite', agentName: 'A', status: 'Pending', totalCases: 5 });
```

with:

```ts
    expect(result.summary).toEqual({
      id: 'g1', suiteName: 'Suite', agentName: 'A', status: 'Pending', totalCases: 5,
      awaitable: { kind: 'test-run', id: 'g1' },
    });
```

Also widen the `result` cast's `summary` type at the top of that test to include the handle. Replace:

```ts
      artifactRef: string; kind: string; summary: { id: string; status: string; totalCases: number };
```

with:

```ts
      artifactRef: string; kind: string;
      summary: { id: string; status: string; totalCases: number; awaitable: { kind: string; id: string } };
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/tracey/tracey-tools.spec.ts -t "start_test_run fires the run"`
Expected: FAIL — summary is missing `awaitable`.

- [ ] **Step 3: Add the handle to the summary**

In `frontend/src/features/tracey/tools/runs.ts`, in `start_test_run`'s `execute`, update the `store(...)` summary object to include the handle:

```ts
      const group = await testRunGroupsApi.create(suiteId, [agent.endpointId]);
      return store('test-run-group', group, {
        id: group.id,
        suiteName: group.suiteName,
        agentName: group.agentName,
        status: group.status,
        totalCases: group.runs.reduce((sum, run) => sum + run.totalCases, 0),
        awaitable: { kind: 'test-run', id: group.id },
      });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/tracey/tracey-tools.spec.ts -t "start_test_run fires the run"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/daniel/Proxytrace
git add frontend/src/features/tracey/tools/runs.ts frontend/src/features/tracey/tracey-tools.spec.ts
git commit -m "feat(tracey): start_test_run returns an awaitable handle

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `submit_optimization_theory` returns an awaitable handle

**Files:**
- Modify: `frontend/src/features/tracey/tools/proposals.ts`
- Test: `frontend/src/features/tracey/tracey-tools.spec.ts:291`

- [ ] **Step 1: Update the failing test**

In `frontend/src/features/tracey/tracey-tools.spec.ts`, in the test `submits as Tracey AI when confirmed`, replace:

```ts
    expect(result).toEqual({ id: 'th1', status: 'Proposed' });
```

with:

```ts
    expect(result).toEqual({ id: 'th1', status: 'Proposed', awaitable: { kind: 'theory', id: 'th1' } });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/tracey/tracey-tools.spec.ts -t "submits as Tracey AI when confirmed"`
Expected: FAIL — result is missing `awaitable`.

- [ ] **Step 3: Add the handle to the success return**

In `frontend/src/features/tracey/tools/proposals.ts`, in `submit_optimization_theory`'s `execute`, replace the success return inside the `try`:

```ts
        try {
          return await theoriesApi.submit({ agentId, suiteId, priority, rationale, source: TheorySource.TraceyAi, details });
        } catch (error) {
```

with:

```ts
        try {
          const theory = await theoriesApi.submit({ agentId, suiteId, priority, rationale, source: TheorySource.TraceyAi, details });
          return { ...theory, awaitable: { kind: 'theory', id: theory.id } };
        } catch (error) {
```

Note: spreading `theory` keeps every `TheoryDto` field, so `TheoryToolUI`/`LiveTheoryCard` (which type-guard on `id`/`rationale`/`agentId`/`suiteId`) still render unchanged; the extra `awaitable` field is ignored by the card and read only by Tracey.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/tracey/tracey-tools.spec.ts -t "submits as Tracey AI when confirmed"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/daniel/Proxytrace
git add frontend/src/features/tracey/tools/proposals.ts frontend/src/features/tracey/tracey-tools.spec.ts
git commit -m "feat(tracey): submit_optimization_theory returns an awaitable handle

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Teach Tracey + sync docs

**Files:**
- Modify: `frontend/src/features/tracey/skills/suites-runs-skill.md`
- Modify: `frontend/src/features/tracey/skills/optimization-skill.md`
- Modify: `frontend/src/features/tracey/TRACEY.md`
- Modify: `manual/guide/tracey.md`

- [ ] **Step 1: Update the suites-runs skill**

In `frontend/src/features/tracey/skills/suites-runs-skill.md`, replace the paragraph that begins "Once you confirm, the user sees a **live progress card**…" (the one added for the live card) — i.e. the last paragraph of the `## Start a run` section, immediately before the `To go beyond a single run…` paragraph — with:

```markdown
Once confirmed, the user sees a **live progress card** that streams completion and pass/fail as
cases finish. `start_test_run` returns an `awaitable` handle (`{ kind: "test-run", id }`).

To react to results in the same turn, **wait for the run**: collect the `awaitable` handle(s) and
call `await_actions` **once** with all of them, then analyze what comes back. Starting several
runs? Fire every `start_test_run` first, then a single `await_actions([…all handles…])` — never
one wait per run, and never poll `get_run` in a loop yourself. If a wait reports `timedOut`, tell
the user the run is still going and to check back.
```

- [ ] **Step 2: Update the optimization skill**

In `frontend/src/features/tracey/skills/optimization-skill.md`, find the step where the theory is submitted via `submit_optimization_theory` (the live theory card / A/B validation step) and append this guidance to it (keep surrounding text intact):

```markdown
`submit_optimization_theory` returns an `awaitable` handle (`{ kind: "theory", id }`). To report
the outcome in the same turn, call `await_actions([handle])` after submitting; it resolves when
the A/B validation finishes (Validated or Invalidated). Then tell the user the result — on a win,
mention the proposal it created (`resultingProposalId`). If it reports `timedOut`, say validation
is still running and to check back.
```

- [ ] **Step 3: Update TRACEY.md**

In `frontend/src/features/tracey/TRACEY.md`, in the `## Tools: read, write, and render` section, add a new bullet after the **Write tools** bullet:

```markdown
- **Wait tools** (`await_actions`) block until one or more long-running actions reach a terminal
  state, then return a compact aggregate so Tracey reacts in the *same* turn — no card pushes back
  to the thread. `confirm: false`. The producing write tools (`start_test_run`,
  `submit_optimization_theory`) return an `awaitable: { kind, id }` handle; Tracey collects the
  handles and calls `await_actions` once. It polls the relevant API (`tools/await.ts` +
  `tools/poll-until-terminal.ts`) until terminal or a 10-minute per-handle cap (`timedOut`). It has
  no inline card — the per-item live cards already visualize progress, so it falls back to
  `ToolCallCard`.
```

- [ ] **Step 4: Update the user manual**

In `manual/guide/tracey.md`, in the write-actions area (just after the **live run-progress card** paragraph added previously), add:

```markdown
After starting a run (or submitting an optimization theory), Tracey can **wait for the result and
react in the same reply** — she'll come back with an analysis once the run completes, rather than
leaving you to ask. If she's waiting on several runs at once, she waits for all of them and
summarizes together. Very long runs are capped: if one hasn't finished in time she'll tell you it's
still going so you can check back.
```

- [ ] **Step 5: Verify the manual still builds**

Run (from repo root):
```bash
cd /home/daniel/Proxytrace/manual && npm run docs:build
```
Expected: build succeeds (VitePress emits the static site with no errors).

- [ ] **Step 6: Commit**

```bash
cd /home/daniel/Proxytrace
git add frontend/src/features/tracey/skills/suites-runs-skill.md frontend/src/features/tracey/skills/optimization-skill.md frontend/src/features/tracey/TRACEY.md manual/guide/tracey.md
git commit -m "docs(tracey): document await_actions in skills + manuals

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full frontend test suite**

Run: `npx vitest run`
Expected: PASS — all suites green, including the new `poll-until-terminal.spec.ts`, `await.spec.ts`, and the updated `tracey-tools.spec.ts`.

- [ ] **Step 2: Type-check + production build**

Run: `npm run build`
Expected: `tsc -b` reports no errors and `vite build` completes. (No `any`, `as any`, or `!` were introduced — confirm the build is clean.)

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: ESLint passes with no errors.

- [ ] **Step 4: Commit any lint auto-fixes (if the working tree changed)**

```bash
cd /home/daniel/Proxytrace
git status --porcelain
# If lint modified files:
git add -A && git commit -m "chore(tracey): lint await_actions changes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** pull tool (Tasks 2–3), generic registry/two kinds (Task 2), handle contract on both producers (Tasks 4–5), polling + 3s interval + 10-min cap + `timedOut` (Tasks 1–2), no card/button/coordinator (omitted by design), skills + TRACEY.md + manual (Task 6), tests for poll loop / predicates / aggregate / producers (Tasks 1,2,4,5). All covered.
- **Type consistency:** `AwaitKind` = `'test-run' | 'theory'` used identically in `await.ts`, the zod `handleSchema`, and both producers' handles. `PollOptions` defined in Task 1, consumed in Task 2. `awaitable: { kind, id }` shape identical across producers, schema, and tests.
- **No placeholders:** every code/edit step shows the exact content; commands have expected output.
