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

You can watch every theory move through validation in the read-only **Theory pipeline**
panel on the **Proposals** page.

## What a theory contains

- **Kind** — the type of change (system prompt, tool update, or model switch).
- **Source** — who proposed it (optimizer, you, Tracey AI, or external).
- **Suite** — the [test suite](/guide/test-suites-and-cases) it will be validated against.
- **Rationale** — why the change is expected to help.
- **Status** — its position in the validation lifecycle.

## The validation lifecycle

```
Proposed → Validating → Validated   → becomes an Optimization Proposal
                     └→ Invalidated  (no improvement; kept for the record)
```

1. **Proposed** — the theory has been accepted into the queue.
2. **Validating** — Proxytrace runs the suite with the proposed change applied (an
   ephemeral A/B run) and compares it against the current agent.
3. **Validated** — the change measurably improved the agent. A Draft **proposal** is
   created automatically, carrying the comparison as evidence.
4. **Invalidated** — the change did not improve the agent. The theory is kept so the same
   idea is not tried again needlessly.

You never lose work: every hypothesis — including the ones that did not pan out — is
recorded, which is also what powers deduplication.

## Submitting your own theory

Send a `POST /api/theories` request naming the agent, the suite to validate against, your
rationale, and the proposed change (a new system prompt, a replacement endpoint, or updated
tools). Proxytrace deduplicates and validates it exactly like an optimizer-produced theory;
if it wins, it appears in your proposals list ready to review, and you can follow its status
in the **Theory pipeline** panel.

## Deduplication

A theory that is byte-for-byte identical to one already **Proposed**, **Validating**, or
**Validated** for the same agent is suppressed rather than re-run. Theories identical to an
already **Approved** or **Rejected** proposal are suppressed until **3 more completed
test-run groups** have run against that agent — the same "fresh evidence" threshold used for
proposals.
