# Optimization Proposals

An **Optimization Proposal** is a data-driven recommendation to improve an
[agent](/guide/agents) — for example, switching its model or updating its system prompt.
Each proposal is grounded in evidence from [test runs](/guide/running-tests).

## What a proposal contains

- **Kind** — the type of change (e.g. switch model, update system prompt).
- **Rationale** — why the change is suggested.
- **Priority** — how impactful it is expected to be.
- **Details** — the concrete, typed change (e.g. the new model, or the proposed prompt
  text).
- **Evidence** — the specific test runs that justify the proposal.
- **Status** — `Review`, `Approved`, or `Rejected`.

## Reviewing proposals

Open **Proposals** in the sidebar. New proposals stream in live. For each one:

1. Read the rationale and inspect the linked evidence runs.
2. Compare the proposed change against the current agent definition.
3. **Approve** to accept it, or **Reject** to dismiss it.

## Closing the loop

Approving a proposal is the final step of the Proxytrace loop: traffic was captured,
curated into benchmarks, evaluated, and the results turned into a concrete improvement you
can act on with confidence.
