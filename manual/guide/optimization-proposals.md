# Optimization Proposals

An **Optimization Proposal** is a data-driven recommendation to improve an
[agent](/guide/agents) — for example, switching its model or updating its system prompt.
Each proposal is grounded in evidence from [test runs](/guide/running-tests).

> A proposal is only ever created by **validating an
> [optimization theory](/guide/optimization-theories)** with an A/B test run. The proposal
> records the baseline vs. candidate comparison (pass-rate, cost, latency) as its evidence.
> Theories are the unproven hypotheses; proposals are the ones that earned a measurable win.

## What a proposal contains

- **Kind** — the type of change (e.g. switch model, update system prompt).
- **Rationale** — why the change is suggested.
- **Priority** — how impactful it is expected to be.
- **Details** — the concrete, typed change (e.g. the new model, or the proposed prompt
  text).
- **Evidence** — the specific test runs that justify the proposal.
- **Status** — `Review`, `Approved`, or `Rejected`.

## Reviewing proposals

Open **Proposals** in the sidebar. The page is the **Optimization Theories** board: every
proposal belongs to a **Validated** theory, shown in the board's *Validated* column (see
[Reviewing the board](/guide/optimization-theories#reviewing-the-board)). For each one:

1. **Promote** straight from the validated card to accept it, or click the card to open the
   full review drawer.
2. In the drawer, read the rationale, inspect the A/B results and linked evidence runs, and
   compare the proposed change against the current agent definition.
3. **Approve** to accept it, or **Dismiss** to reject it.

## Deduplication

If you **Reject** or **Approve** a proposal, the optimizer remembers the exact change it
suggested. The next time it would surface an identical proposal (same agent + same
proposed change), it suppresses it instead of asking you again. The proposal is only
re-surfaced after **3 more completed test-run groups** have run against that agent — the
threshold acts as a "fresh evidence" check so you do not keep dismissing the same
suggestion every cycle.

Proposals with a *different* proposed change are not affected; only byte-for-byte
identical re-suggestions are suppressed.

## Closing the loop

Approving a proposal is the final step of the Proxytrace loop: traffic was captured,
curated into benchmarks, evaluated, and the results turned into a concrete improvement you
can act on with confidence.
