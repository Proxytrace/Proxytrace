# Running Tests

A **Test Run** executes a [test suite](/guide/test-suites-and-cases) against a specific
[agent](/guide/agents) version, producing per-case **evaluations** and aggregate metrics.

## Starting a run

1. Choose the suite to run.
2. Choose the agent (and version) to run it against.
3. Start the run.

Each case in the suite is executed against the agent, and every attached
[evaluator](/guide/evaluators) scores the result.

## Watching progress

Runs stream their results live via Server-Sent Events — results fill in as cases complete,
without refreshing the page. Related runs can be grouped together (a **test run group**)
so you can compare, for example, the same suite across several agent versions.

## Reading results

A completed run gives you:

- **Per-case results** — the agent's output for each case and each evaluator's score.
- **Aggregate metrics** — pass rates and scores rolled up across the suite.
- **Comparisons** — how this run stacks up against previous runs of the same suite.

## What runs feed into

Test runs are the evidence behind
[optimization proposals](/guide/optimization-proposals): a proposal references the specific
runs that justify it.
