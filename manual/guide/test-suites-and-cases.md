# Test Suites & Cases

A **Test Suite** is a curated, reproducible benchmark. A **Test Case** is one
input/expected-output entry inside a suite. Together they let you measure agent behavior
the same way every time.

## Building a suite from traces

The intended workflow is to **promote production traces** into durable benchmarks:

1. Find a [trace](/guide/capturing-traces) that represents a critical behavior or a
   regression you want to guard against.
2. Promote it into a test case — the captured input becomes the case input.
3. Group related cases into a test suite.

Because cases come from real traffic, suites stay grounded in behaviors that actually
matter.

## Test cases

Each test case captures the input to run and the expectation to check against. What
"expected" means depends on the [evaluators](/guide/evaluators) attached to the suite —
an exact string, a number within tolerance, a JSON shape, a tool that should be called,
and so on.

## Attaching evaluators

A test suite has a many-to-many relationship with **evaluators**: one suite can score its
cases with several evaluators, and an evaluator can be reused across suites. Choose the
evaluators that express what "correct" means for the suite. See
[Evaluators](/guide/evaluators).

## Running a suite

Once a suite has cases and evaluators, run it against an
[agent](/guide/agents) version to produce a [test run](/guide/running-tests).

## The suites overview

Each suite card surfaces its latest run data at a glance:

- **Pass rate** — the pass rate of the most recent run, with the change versus the
  previous run and a sparkline of the trend across past runs.
- **Test cases** — case count and total number of runs executed.
- **Last run** — when the suite last ran. Suites that have never run are flagged
  *No runs yet*.

Use the **Agent** filter at the top to narrow the list to a single agent. The filter only
lists agents that actually own a suite, so it stays usable no matter how many agents the
project has.
