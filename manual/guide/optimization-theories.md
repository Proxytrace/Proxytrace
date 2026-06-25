# Optimization Theories

An **Optimization Theory** is an *unproven hypothesis* that a specific change to an
[agent](/guide/agents) will improve it — a new system prompt, a different model endpoint,
or updated tool definitions. A theory is just an idea until Proxytrace validates it.

Theories are the front half of the optimization loop; validated theories become
[Optimization Proposals](/guide/optimization-proposals).

## Where theories come from

Any producer can submit a theory into the same validation pipeline:

- **Built-in optimizers** — analyse a completed [test-run group](/guide/running-tests) and
  hypothesise prompt, tool, or model-switch changes.
- **You, Tracey AI, and external callers** — submit theories through the API
  (`POST /api/theories`), naming the target agent, the suite to validate against, and the
  proposed change.

You watch every theory move through validation on the **Proposals** page, which is laid out
as an **Optimization Theories** board (see [Reviewing the board](#reviewing-the-board)).

## What a theory contains

- **Kind** — the type of change (system prompt, tool update, or model switch).
- **Source** — who proposed it (optimizer, you, Tracey AI, or external).
- **Suite** — the [test suite](/guide/test-suites-and-cases) it will be validated against.
- **Rationale** — why the change is expected to help.
- **Status** — its position in the validation lifecycle.
- **A/B metrics** — once tested, the theory records the **baseline → projected pass rate**
  and a **p-value** (a two-proportion test of whether the difference is real or just sampling
  noise). A high p-value (≈ ≥ 0.05) means the change is *inside the noise*.

## The validation lifecycle

```
Proposed → Validating → Validated   → becomes an Optimization Proposal
                     └→ Invalidated  (no improvement; kept for the record)
```

1. **Proposed** — the theory has been accepted into the queue.
2. **Validating** — Proxytrace runs the suite with the proposed change applied (an
   ephemeral A/B run) and compares it against the current agent. These internal A/B runs
   are hidden from the [test run](/guide/running-tests) list by default so they don't clutter
   your own results — they live with the theory and its resulting proposal instead, and can be
   revealed with the **A/B runs** toggle.
3. **Validated** — the change improved the agent beyond sampling noise (p-value ≤ 0.05).
   A Draft **proposal** is created automatically, carrying the comparison as evidence.
4. **Invalidated** — the change did not improve the agent, or the improvement was within
   the noise. The theory is kept so the same
   idea is not tried again needlessly.

You never lose work: every hypothesis — including the ones that did not pan out — is
recorded, which is also what powers deduplication.

## Reviewing the board

![The Optimization Theories board: Proposed, Validating, Validated, and Rejected columns of theory cards, with a summary strip of theory count, win rate, and proven gain.](/screenshots/theories/board.png)

Open **Proposals** in the sidebar. Theories are arranged on a pipeline board with one column
per lifecycle state — **Proposed**, **Validating**, **Validated**, and **Rejected** — and a
summary strip showing the total theory count, how many have been **tested**, the **win rate**
(share of tested theories that were validated), and the total **proven gain** in percentage
points.

Each card shows the kind, rationale, target agent, and suite. **Validated** cards show the
measured pass-rate jump and a **Promote** button that accepts the resulting proposal in one
click; **Rejected** cards show the (non-)improvement and the p-value verdict.

Click an unproven or rejected card to open its **decision flow** — a top-to-bottom timeline of
the theory's lifecycle: the **evidence** runs that motivated it → the **theory** (the proposed
change as a diff) → the **A/B validation** result → the **proposal** it produced (if the test
won) → the **outcome**. A theory the A/B disproved is *auto-rejected* (no human review).

A **validated** theory's drawer skips the timeline and leads with what matters for the decision:
the **effective gain** (the measured pass-rate jump, with the p-value verdict) and the **concrete
change to apply** — the prompt diff, tool definition diff, or model swap — with **Promote** and
**Dismiss** immediately at hand. The background that produced the proposal (the theory's
rationale, the evidence runs, and the full A/B test result) stays available under a collapsed
**Theory & A/B test details** section.

The board updates itself as theories move through the pipeline — it polls live while any theory
is still validating, so status changes, spawned proposals, and recorded metrics appear without a
manual refresh.

The A/B validation detail carries a **View A/B run** link to the exact run that decided the
theory. The link is attached **as soon as the run starts**, so it is already present while the
theory is still *Validating*, and it stays on **rejected** theories too, so you can inspect the
worse run that caused the rejection. Following it opens the [runs](/guide/running-tests) view with
that A/B run revealed and selected.

## Dismissing a theory

You don't have to wait for the A/B test on every theory. Two actions let you take a theory out of
the pipeline yourself — both on the card and in its decision flow:

- **Reject** (on a *Proposed* theory) — dismisses it **without running A/B validation**. Use it for
  hypotheses you've already judged not worth a validation run.
- **Cancel validation** (on a *Validating* theory) — **aborts the in-flight A/B run** and dismisses
  the theory. Use it to stop a run you no longer need.

Either action moves the theory to **Rejected**. Because it was never measured, the card shows that
it was "dismissed without running an A/B validation" rather than a pass-rate verdict — and you can
still **Reset to Proposed** later to validate it after all.

Theories validate **one at a time**: only a single A/B run is ever in flight, and the rest wait in
the queue. Rejecting queued theories or cancelling the running one is how you keep that backlog under
control.

## Re-validating a theory

A **Validated** or **Rejected** theory's drawer carries a **Reset to Proposed** button. It
returns the theory to the start of the lifecycle — deleting any draft/dismissed proposal it
spawned, clearing the recorded A/B metrics, and re-queuing it for a fresh validation run. Use it
to retry a theory after the agent, suite, or model has changed.

Reset is **not** offered once a proposal has been **promoted** (accepted): the change is already
applied to the agent, and resetting would not revert it. Dismiss-then-reset is fine; promoted
proposals are not resettable.

## Submitting your own theory

Send a `POST /api/theories` request naming the agent, the suite to validate against, your
rationale, and the proposed change (a new system prompt, a replacement endpoint, or updated
tools). Proxytrace deduplicates and validates it exactly like an optimizer-produced theory;
if it wins, it appears in the **Validated** column ready to promote, and you can follow its
status across the board as it moves through validation.

## Deduplication

A theory that is byte-for-byte identical to one already **Proposed**, **Validating**, or
**Validated** for the same agent is suppressed rather than re-run. Theories identical to an
already **Approved** or **Rejected** proposal are suppressed until **3 more completed
test-run groups** have run against that agent — the same "fresh evidence" threshold used for
proposals.
