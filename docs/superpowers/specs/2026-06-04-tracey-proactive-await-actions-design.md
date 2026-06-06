# Tracey — proactive reaction to long-running actions (`await_actions`)

**Date:** 2026-06-04
**Status:** Approved (design), pending implementation plan
**Area:** `frontend/src/features/tracey`

## Problem

When Tracey starts a long-running action she fires and forgets. `start_test_run` creates a
run, the live progress card streams to completion, and Tracey's turn ends. To react to the
result the user must manually prompt her ("how did it go?"). The same gap exists for
`submit_optimization_theory`, whose A/B validation runs in the background while the turn ends.

We want Tracey to react to the *result* on her own, in the same turn — without the user having
to nudge her.

## Key constraint that shapes the design

The assistant-ui thread is single-track; turns are sequential. A naive "card pushes a message
back to Tracey on completion" model breaks under fan-out: if Tracey starts three runs on three
agents, three cards finishing would race to inject three messages into one thread. Any push
model would need an idle-detecting, reload-deduping coordinator that coalesces completions into
one message — significant machinery, and it re-engages Tracey even mid-other-conversation.

## Decision: pull, not push

Tracey **decides to wait** by calling a tool. A new client-side tool `await_actions` resolves
when the action(s) reach a terminal state and hands her the aggregate result. Everything stays
inside **one turn**: no thread races, natural fan-out aggregation, and the agent's own tool loop
(`stopWhen: stepCountIs(8)`) drives the continuation. The existing live progress cards stay
purely visual.

```
start_test_run(A) → handle hA   (live card A appears)
start_test_run(B) → handle hB   (live card B appears)
start_test_run(C) → handle hC   (live card C appears)
await_actions([hA,hB,hC])       → resolves when all 3 terminal → aggregate
…Tracey: "B regressed to 5/10, here's why…"   (one assistant message, same turn)
```

No upstream LLM call is active *during* the wait — the turn is just awaiting a browser promise;
the next reasoning step fires only once results land. Step budget comfortably covers
`N×start + 1×await + reasoning`.

## Generic over bespoke

There are exactly two long-running async actions today, structurally identical:

| Action | Produces | Terminal when | Poll via |
|---|---|---|---|
| `start_test_run` | test-run group id | `Completed` / `Failed` / `Cancelled` | `testRunGroupsApi.get` |
| `submit_optimization_theory` | theory id | `Validated` / `Invalidated` | `theoriesApi.get` |

Everything else (`set_proposal_status`, all reads, `navigate`, display tools) is instant. Two
real consumers — plus a plausible mixed batch (the optimize flow may run a baseline test run,
then submit a theory, then wait for both) — justify one generic tool over two bespoke ones. The
wait/cap/parallel/aggregate logic is written once.

## The tool

```
await_actions({ handles: { kind: 'test-run' | 'theory', id: string }[] })
confirm: false   // read-only wait, no mutation
```

`execute`: `Promise.all` over the handles; each runs a poll loop until its kind's `isTerminal`
predicate holds or the shared cap is hit, then summarizes. Returns one aggregate. Per-handle
result carries `timedOut: boolean`.

> **Implementation note:** the aggregate is returned **inline**, not through the artifact `store()`.
> The aggregate is already compact and there is no `await_actions` card to resolve a stored
> reference (it falls back to `ToolCallCard`), so storing it would only add a blob nothing reads.
> (The per-item live cards already visualize progress.)

### Awaitable registry

Each kind is one well-bounded unit:

```ts
interface AwaitableKind<S> {
  poll: (id: string) => Promise<S>;       // fetch current state
  isTerminal: (snapshot: S) => boolean;   // reached an end state?
  summarize: (snapshot: S) => unknown;    // compact result for the model
}

const AWAITABLES = {
  'test-run': { /* testRunGroupsApi.get, status ∈ {Completed,Failed,Cancelled}, pass/fail/total */ },
  'theory':   { /* theoriesApi.get,       status ∈ {Validated,Invalidated},      outcome + proposalId */ },
};
```

Registry starts with exactly the two kinds that exist — no speculative kinds. A future async
action becomes: one registry entry + an `awaitable` handle on its producer. Nothing else changes.

### Handle contract

The two producing tools each return an `awaitable: { kind, id }` in their summary:

- `start_test_run` → `awaitable: { kind: 'test-run', id: group.id }`
- `submit_optimization_theory` (success) → `awaitable: { kind: 'theory', id: theory.id }`

Tracey collects these from the tool results and passes them to `await_actions`.

## Polling, not SSE (for the tool)

The registry primitive is polling (`poll(id) → snapshot` + `isTerminal`): plain async, trivially
testable with injected timers, and no need to refactor the React SSE hooks into a non-hook form.
Live cards keep their existing SSE for the *visual*; the tool polls independently for Tracey's
*reasoning*. Decoupled consumers — minor duplication, clean separation.

- Interval: a constant (`~3s`).
- Cap: `AWAIT_ACTIONS_TIMEOUT_MS = 10 min` (tunable). Per-handle — a slow theory doesn't void a
  finished run. On cap, the handle's summary sets `timedOut: true` with the last-known status;
  Tracey tells the user it's still running and to check back.

SSE-based waiting is a possible later optimization (instant resolution, no request volume); not
in scope.

## Reload behavior

A page reload mid-wait kills the turn and its pending promise; the run/theory keeps going
server-side. There is **no auto-recovery** — the user simply asks Tracey again ("how did they
go?"), which resolves through the existing `get_run` / `get_proposal` read tools. (A manual
"Ask Tracey to review" button on the card was considered and dropped as YAGNI.)

## How Tracey learns to use it

- `TRACEY_TOOLS_META`: add `await_actions` (slash menu).
- `suites-runs-skill.md`: after starting run(s), collect each result's `awaitable`, call
  `await_actions([…])` **once**, then analyze. Explicit: start all runs first, await in a single
  call (the fan-out pattern).
- `optimize-agent` skill: after `submit_optimization_theory`, await its handle and report the
  outcome instead of ending the turn.
- The base system prompt stays lean; the skills carry the playbook (consistent with how
  state-changing actions are already documented).

## Files

**New**
- `tools/await.ts` — `createAwaitTools` factory (`await_actions`) + the `AWAITABLES` registry.
- `tools/poll-until-terminal.ts` — pure `pollUntilTerminal(poll, isTerminal, { intervalMs,
  timeoutMs, sleep })` with injectable timers.

**Edited**
- `tools/runs.ts` — `start_test_run` summary gains `awaitable`.
- `tools/proposals.ts` — `submit_optimization_theory` success return gains `awaitable`.
- `tracey-tools.ts` — wire `createAwaitTools`; add `await_actions` to `TRACEY_TOOLS_META`.
- `skills/suites-runs-skill.md`, `skills/optimization-skill.md` — playbook updates.
- `frontend/src/features/tracey/TRACEY.md`, `manual/guide/tracey.md` — keep docs in sync.

**Not built**
- No tool-UI card for `await_actions` (falls back to `ToolCallCard`); per-item live cards already
  visualize. Add later only if a summary card proves useful.
- No card→runtime coupling, no "review" button, no push coordinator.

## Testing

- `poll-until-terminal.spec.ts` — resolves on terminal; times out → `timedOut`; uses an injected
  fake clock (no real waiting).
- `await.spec.ts` — both kinds' `isTerminal`; `await_actions` aggregates a mixed batch (mock
  `testRunGroupsApi.get` / `theoriesApi.get` returning running→terminal); aggregate shape +
  per-handle `timedOut`.
- `tracey-tools.spec.ts` — both producers emit the `awaitable` handle.

## Out of scope / non-goals

- Push/coalescing coordinator.
- Auto-recovery of a turn lost to reload.
- SSE-driven waiting in the tool.
- A dedicated `await_actions` results card.
- Speculative awaitable kinds beyond `test-run` and `theory`.
