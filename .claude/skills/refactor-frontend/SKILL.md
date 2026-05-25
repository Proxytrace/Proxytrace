---
name: refactor-frontend
description: >-
  Autonomously analyze and refactor the React/TypeScript frontend in `frontend/`
  until it conforms to BEST_PRACTICES.md. Finds problematic components by concrete
  signals — files over 300 lines, multiple components per file, high complexity,
  inline SVG icons, raw useQuery/useMutation in pages, stray useEffect, inline
  style={{}}, any/as-any/non-null `!` — builds a prioritized plan, then works the
  ENTIRE list end-to-end without pausing for approval, verifying build + lint +
  tests stay green after every change. Use whenever the user wants to clean up,
  refactor, restructure, split, decompose, simplify, or improve the quality/
  architecture of the frontend, React, or .tsx components; says a component is too
  big / too long / too complex / a mess; mentions code smells, tech debt, or
  oversized files in the UI; or says "refactor the frontend". Prefer this over
  plan-refactor / refactor for frontend-only work that should run to completion
  autonomously rather than one item at a time.
---

# Refactor Frontend (autonomous)

Drive the Proxytrace frontend toward the target state defined in
[`frontend/BEST_PRACTICES.md`](../../../frontend/BEST_PRACTICES.md): small,
single-purpose, obvious components; TanStack Query as the only data layer; no
inline SVG, no inline static styles, no `any`/`!`; logic extracted and tested.

This skill is **autonomous**. You analyze, prioritize, and then refactor the
whole prioritized list to completion. You do **not** stop to ask "should I
continue?" after each item. The user has explicitly asked for a finished,
cleanly-implemented SOTA React frontend and does not care how much effort it
takes — so optimize for thoroughness and correctness, never for finishing fast
or saying less.

This skill is also **parallel**. You are the orchestrator: you scan, plan, and
group independent items into batches, then dispatch each batch to a sub-agent so
they refactor different parts of the tree at the same time. This saves wall-clock
time and keeps the orchestrator's context small — each sub-agent reads only its
own slice instead of you reading every file. Parallelism never overrides the two
non-negotiables below: batches are constructed so concurrent agents can never
touch the same file, and the build is verified green at the end of every wave.

## Mandatory reading before any edit

Read both, in full, once at the start. They override any generic advice:

1. `frontend/BEST_PRACTICES.md` — code architecture: the size-limit table (§1),
   feature-folder layout (§2), the data layer (§3), `useEffect` discipline (§4),
   container/presentational split (§5), icons (§6), styling mechanics (§7),
   performance (§8), states (§9), typing (§10), a11y (§11), testing (§12), and
   the §14 pre-merge checklist that is the definition of "done" for each item.
2. `frontend/DESIGN.md` — the visual system. You must not change how anything
   looks while refactoring; DESIGN.md is how you know what "looks the same" means
   (tokens, which primitive to render).

Also study the repo's good counter-examples before you start moving code, because
you will imitate their shape: `features/runs/`, `features/playground/`,
`api/agents.ts`, `api/query-keys.ts`, `components/ui/classes.ts`, `lib/cn.ts`.

## The two non-negotiables

Everything below serves these. If a step would violate one, stop and rethink.

1. **Behavior and appearance are preserved.** Refactoring restructures code
   without changing observable behavior or pixels. You are moving and renaming,
   not redesigning. If you find a real bug, note it in the plan as a separate
   item — do not silently "fix" it inside a refactor, because that destroys your
   ability to tell a refactor regression from an intended change.
2. **The build stays green after every item.** `npm run build`, `npm run lint`,
   and `npm test` (run inside `frontend/`) must pass after each item before you
   move to the next. A red build is a stop-the-line event: fix it before doing
   anything else. Never suppress an error with `any`, `as any`, `!`, or an
   eslint-disable to get to green — that is the opposite of the goal.

## Phase 0 — Establish a green baseline

You cannot attribute a failure to your work if the tree was already broken.
From `frontend/`:

```bash
npm install        # only if node_modules is missing
npm run build && npm run lint && npm test
```

- All green → record it and proceed.
- Already red → do **not** start refactoring on top of a broken baseline. Report
  the failing output to the user and ask whether to fix the breakage first or
  proceed anyway. This is the one place you pause, because a bad baseline
  invalidates every later "still green" check.

## Phase 1 — Scan and inventory

Run the bundled scanner from the repo root to get a deterministic, ranked list of
candidates by the exact signals BEST_PRACTICES.md cares about:

```bash
python3 .claude/skills/refactor-frontend/scripts/scan.py            # ranked table
python3 .claude/skills/refactor-frontend/scripts/scan.py --json     # for the plan
```

Columns: `LINES CMP STY QRY SVG EFF ANY !` (component fns, inline styles, raw
useQuery/Mutation, inline `<svg>`, useEffect, any/as-any, non-null `!`). The
score ranks; it does not adjudicate. **Read each flagged file before acting** —
the heuristic has known blind spots:

- `components/icons/index.tsx` legitimately holds many tiny components — that is
  the sanctioned single icon module (BEST_PRACTICES §6), not a split candidate.
  A genuinely cohesive ~310-line component may be acceptable; a 180-line file
  with 6 components and 4 effects is not. Judge with the per-signal columns.
- The scanner sees structure, not duplication. Also look for copy-pasted logic,
  threaded styling props (`color: 'var(--...)'` passed down), server data mirrored
  into `useState`, and missing loading/empty/error states — these are real smells
  the scanner can miss.

## Phase 2 — Prioritize and write the plan

Write `frontend/REFACTOR-FRONTEND-PLAN.md` — a durable, resumable backlog. If it
already exists from an earlier run, read it, keep finished items marked done, and
merge new findings rather than clobbering it. This file is your memory: if the
session is interrupted, re-running the skill resumes from it.

Rank by a blend of **severity** (forbidden constructs and hard-limit breaches
first) and **risk/blast-radius** (prefer changes that are easy to verify safe and
that unblock later items). A sensible default order:

- **P1 — Forbidden / correctness:** `any`, `as any`, non-null `!`, `<div onClick>`,
  server data copied into `useState`, an effect doing data-fetching.
- **P2 — Structural blockers:** files over the 300-line hard limit, >2 components
  per file, a page holding raw `useQuery`/business logic, the giant debt files.
- **P3 — Mechanics:** inline `<svg>` → icon module, static `style={{}}` → Tailwind/
  `classes.ts`, query keys → `QUERY_KEYS`, threaded color props → semantic props.
- **P4 — Polish:** naming, import ordering, redundant `useMemo`/`useCallback`.

Each item: a short imperative title, the file(s) in scope, the priority, the
observed smell (one or two sentences, cite the BEST_PRACTICES section), and a
concrete approach. Big files become **several sequential items**, not one — see
"Decomposing a monster file". Record the **exact file set each item reads or
writes** — you need it to schedule parallel work safely.

### Group items into parallel batches

After the plan exists, partition its items into a schedule of **waves**. Within a
wave, every item runs concurrently in its own sub-agent; waves run one after
another. Two rules decide the grouping:

1. **Disjoint files within a wave.** Two items may run in the same wave only if
   their file sets (read *and* write) do not overlap. Concurrent agents editing
   the same file corrupt each other. Feature folders are naturally independent —
   BEST_PRACTICES forbids cross-feature imports — so `features/agents/*` and
   `features/suites/*` items are safe to run together; two items both decomposing
   `features/evaluators/Evaluators.tsx` are not (serialize them).
2. **Shared modules go first, alone.** Any item touching a cross-cutting module —
   `components/icons/`, `components/ui/classes.ts`, `api/query-keys.ts`,
   `api/models.ts`, anything in `lib/` or `components/ui/` — is a **dependency**
   of the feature items that will import from it. Do all shared-module work in an
   early serial wave (or directly in the orchestrator), so later feature-agent
   waves build on a stable shared surface and never edit it.

A monster file (e.g. `Evaluators.tsx`) is one agent's job for the whole wave: its
internal steps stay sequential (see "Decomposing a monster file"), but it runs in
parallel with agents working *other* folders. Record the schedule in the plan as
`Wave 1: [items…]`, `Wave 2: [items…]` so a resumed run knows what is in flight.

Then tell the user the plan is written, show the wave schedule, and say you are
starting execution and will run the whole list across parallel agents — you are
not waiting for per-item approval.

## Phase 3 — The parallel refactor loop

Work the schedule **wave by wave**. For each wave:

1. **Dispatch one sub-agent per item in the wave, in a single message** (multiple
   Agent tool calls in one turn) so they run concurrently. Use the
   `general-purpose` agent type. Give each agent its own item only — never two
   items whose files overlap (you already guaranteed this when batching).
2. **Wait for the whole wave to return** before starting the next. Collect each
   agent's report (files changed, tests added, any new smell discovered).
3. **Integrate and verify once for the wave.** From `frontend/`, run the full
   `npm run build && npm run lint && npm test` a single time. This is the wave's
   green gate — running it once instead of once-per-item is most of the time/token
   saving. Red → see "When a wave comes back red" below.
4. **Re-scan** (`scan.py`) and **check off** every completed item in
   `REFACTOR-FRONTEND-PLAN.md`. Fold any new smells the agents reported into the
   plan at the right priority and schedule them into a later wave this same run.
5. Move to the next wave.

### What to put in each sub-agent's prompt

Each agent is stateless and starts with empty context, so the prompt must be
self-contained. Include:

- **Mandatory reading:** instruct it to read `frontend/BEST_PRACTICES.md` and
  `frontend/DESIGN.md` in full first, and to study the relevant good
  counter-example (`features/runs/`, `api/agents.ts`, `components/ui/classes.ts`,
  `lib/cn.ts`).
- **The exact item:** title, file(s) in scope, the smell + cited BEST_PRACTICES
  section, and the concrete transform from the playbook below.
- **The two non-negotiables:** preserve behavior and appearance; do not change
  pixels; never suppress types/lint to reach green.
- **Strict scope fence:** it may edit only the files listed for its item; if it
  finds another smell it must report it back, not fix it. It must **not** edit any
  shared module (those were handled in an earlier wave). It must **not** commit.
- **Self-check (not the full build):** because parallel `npm run build` collides on
  `dist/`, the agent must verify its slice with `npx tsc --noEmit` and
  `npx eslint <its files> --fix` only — the orchestrator runs the full build+test
  for the wave. It should add a Vitest `*.spec.ts` for any risky pure logic it
  extracts (BEST_PRACTICES §12) and run just that spec with `npx vitest run <file>`.
- **Required report:** the files it changed, tests it added, the before/after of
  the smell, and any new smell it spotted but left untouched.

### When a wave comes back red

Because the wave's file sets were disjoint, a failure is almost always inside one
item's files — bisect by the failing path. Re-dispatch that one item to a fresh
sub-agent with the build output, or fix it yourself if it is a one-liner. Never
paper over it with `any`/`!`/eslint-disable. Do not start the next wave until the
current one is green.

A safety-net option for risky waves: dispatch sub-agents with `isolation:
"worktree"` so each works an isolated copy, then integrate the green ones. Default
to the shared-tree flow above (disjoint files make it safe and avoids merge
friction); reach for worktrees only when you cannot guarantee disjoint file sets.

**Do not commit.** Leave all changes in the working tree for the user to review.

## Refactoring playbook

Map each smell to the canonical transform. These all preserve behavior.

- **File over 300 lines / >2 components per file (§1, §2):** extract the inner
  components into their own files under `features/<f>/components/`. The page keeps
  only orchestration. Move constants, label maps, and `Record<Enum,…>` lookups to
  a plain `features/<f>/<feature>.ts`.
- **Raw `useQuery`/`useMutation` in a component (§3):** move it into a
  `features/<f>/hooks/useXxx.ts` that wraps the call, sources its key from
  `QUERY_KEYS` (`api/query-keys.ts`), and owns `enabled`/`staleTime`/`select`.
  The component then reads `const { data, isLoading } = useXxx()`. New endpoints
  get a thin typed function in `api/<service>.ts` first.
- **Inline string query keys (§3.2):** replace with the `QUERY_KEYS` factory.
  Mutations `invalidateQueries`; never refetch a page on an SSE event (use
  `setQueryData`).
- **`useEffect` smell (§4):** apply the decision table. Data → Query. Value from
  props/state → compute inline or `useMemo`. Reset on prop change → `key` prop.
  Syncing two states → lift to one source and derive. Event response → do it in
  the handler. Keep effects only for genuinely external systems (SSE, DOM,
  timers, storage), and wrap those in a `use*` hook.
- **Server data in `useState` (§3.2, §4.2):** delete the mirror; read from the
  Query cache or derive. For edits, use an explicit, clearly-separate draft state.
- **Inline `<svg>` icon (§6):** delete it; import the equivalent from
  `components/icons`. If it does not exist there, add it to that one module, then
  import. Never declare an `<svg>` icon inside a feature file.
- **Static `style={{}}` (§7):** convert to Tailwind utilities; use arbitrary-value
  syntax for complex statics (`shadow-[var(--shadow-card)]`). Keep `style={{}}`
  only for genuinely runtime-computed values (a data-driven percent width, a
  runtime hex from `lib/colors.ts`). Use `cn()` for conditional classes; lift a
  class recipe reused 3+ times into `components/ui/classes.ts`.
- **Threaded styling props (§5.1):** stop passing `color: 'var(--...)'` down.
  Pass a semantic prop (`variant`, `kind`) and let the leaf map it to a class via
  `lib/colors.ts` / DESIGN tokens.
- **`any` / `as any` / `!` (§10):** narrow with type guards, type DTOs in
  `api/models.ts`, make `Record<Enum,…>` maps exhaustive. Fix the type; never
  escape it.
- **Missing loading/empty/error (§9):** add `Skeleton` (shaped like the layout),
  `EmptyState`, and an error branch off Query's `isError`.
- **`<div onClick>` (§11):** replace with a real `<button>`/`Button`/`IconButton`;
  icon-only controls get `aria-label`.
- **Redundant memoization (§8):** remove `useMemo`/`useCallback` that guards
  nothing; keep only those a downstream `memo`/dep-array actually needs.

## Decomposing a monster file

`features/evaluators/Evaluators.tsx` (≈1400 lines, ~28 components, ~185 inline
styles) is the worst case. Never do it in one edit. Stage it as separate plan
items, verifying green after each so a regression is trivially bisectable:

1. Extract pure constants / label maps / `initForm()` → `evaluators.ts`.
2. Extract the leaf presentational components, one cohesive cluster per item,
   into `components/` — innermost/most-reused first.
3. Extract data access into `hooks/useEvaluators*.ts` over `QUERY_KEYS`.
4. Replace inline `<svg>` with `components/icons`; convert static `style={{}}`.
5. Pull testable pure logic into `.ts` + `.spec.ts`.
6. Reduce the page to a thin orchestrator that wires hooks to subcomponents.

Each step ends green. The whole point of small sequential items is that an
autonomous loop can recover from any single bad step.

A monster file belongs to **one** sub-agent for the whole wave — its steps above
are sequential and share the same files, so they cannot be split across parallel
agents. That single agent runs concurrently with agents working *other* folders.
Give it all six steps as one item and let it self-verify its slice with
`tsc --noEmit` / scoped `eslint` between steps.

## Completion — "done", and the final report

You are done only when **all** hold:

- Every item in `REFACTOR-FRONTEND-PLAN.md` is checked off (or explicitly marked
  as a deliberate, documented exception — e.g. the icon module's component count,
  or a file that is genuinely cohesive at ~310 lines).
- A fresh `scan.py` run shows no remaining hard-limit breaches or forbidden
  constructs (or only documented exceptions).
- `npm run build && npm run lint && npm test` are green.

Converging is expected: each item removes violations, so the scan score falls run
over run. If a file truly cannot go under 300 lines without harming clarity,
record it as an exception with a one-line reason rather than forcing an ugly
split — the goal is readable code, not a number.

Then report to the user: items completed, the most impactful changes (a few
lines), final scan delta (before → after), confirmation the build is green, and
that nothing was committed so they can review the diff.

## Guardrails

- **Do not commit.** Leave changes for the user (project rule).
- **Do not change behavior or appearance.** Restructure only.
- **Do not stop mid-list for approval.** Run the plan to completion; the user
  asked for autonomy.
- **Do not suppress types or lint** to reach green.
- **Do not copy a neighbor's anti-pattern** because it is already there — the debt
  files are debt, not precedent.
- **Do not import across feature boundaries**; shared code moves up to
  `components/`, `hooks/`, or `lib/`.
- **Never run two parallel agents over overlapping files.** Disjoint file sets
  per wave is the invariant that makes shared-tree parallelism safe.
- **Shared modules are serialized, never parallel.** Touch `icons/`, `classes.ts`,
  `query-keys.ts`, `models.ts`, `lib/`, `components/ui/` in an early solo wave.
- **Sub-agents self-check with `tsc --noEmit` + scoped `eslint` only**; the
  orchestrator owns the full `npm run build && npm test` once per wave (parallel
  `npm run build` collides on `dist/`).
