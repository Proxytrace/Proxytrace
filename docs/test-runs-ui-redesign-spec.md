# Test-Runs UI — Functional Spec (for redesign)

Implementation-agnostic description of what the Test-Runs UI does.
Intended as a handoff brief: enough to redesign the screen from scratch (any framework/model) without reading the current code.
Captures behavior and invariants, not layout or component structure.

## Purpose

View and compare results of running a **test suite** against an **agent**, across one or more **model endpoints**. Audience: a dev / ML engineer scanning pass/fail and divergence at a glance, then drilling into individual cases. Dense, dark, calm — information density over whitespace.

## Data model

- **Run group** — one suite executed against one agent, over 1..N model endpoints. Fields: `id`, `suiteName`, `agentName`, `agentId`, `status`, `createdAt`, `runs[]`.
- **Run** — a per-endpoint execution within a group. Fields: `endpointName` (the model), `status`, `passedCases`, `totalCases`, `durationMs`, `passRate`, `results[]`, `testCases[]`, `evaluators[]`.
- **Result** — one test case in one run. Fields: `testCaseId`, `testCaseSummary`, `durationMs`, `actualResponse`, `evaluations[]`.
- **Evaluation** — one evaluator's verdict on a result. Fields: `evaluatorId`, `evaluatorName`, `evaluatorKind`, `score` (enum, e.g. Poor / Mediocre / Acceptable / Good / Excellent), `reasoning`, `errorMessage`.
- **Test case (pending)** — a case that has not produced a result yet.

### Verdict rules (must stay identical everywhere they appear)

- An evaluator **passes** if it is not errored AND its score is in the passing set `{Acceptable, Good, Excellent}`.
- A case **passes** only if *every* evaluator passes. Verdict is `null` when the case has no evaluators yet.
- Case **score** = fraction of evaluators that passed (0..1). An errored evaluator counts as non-pass.
- **Pass rate** = `round(passed / total × 100)`, `null` when total is 0.
- **Status** values: Pending / Running / Completed / Failed. A run/group is **active** when Running or Pending.