# Evaluators

An **Evaluator** is a configurable scoring function. When a [test run](/guide/running-tests)
executes, each evaluator attached to the suite scores every test result and returns an
**evaluation**.

## Evaluator types

Proxytrace ships several evaluators, grouped into rule-based and LLM-based ("agentic")
families.

### Rule-based

| Evaluator | Scores by |
|---|---|
| **Exact Match** | The response equals the expected value exactly. |
| **Numeric Match** | A numeric answer falls within tolerance of the expected number. |
| **JSON Schema Match** | The response conforms to an expected JSON schema. |
| **Tool Usage** | The agent called (or avoided) the expected tool(s). |

### LLM-based (agentic)

These use a model to judge qualities that rules can't capture:

| Evaluator | Scores by |
|---|---|
| **Helpfulness** | How well the response addresses the user's need. |
| **Safety Classifier** | Whether the response is safe / policy-compliant. |
| **Politeness** | Tone and courtesy of the response. |
| **Custom** | A criterion you define. |

## Attaching evaluators to a suite

Evaluators are attached to [test suites](/guide/test-suites-and-cases) (many-to-many): a
suite can use several evaluators, and each evaluator can be reused across suites. Pick the
set that expresses what "correct" means for that benchmark.

## The evaluator workspace

Selecting an evaluator opens its workspace, which summarises how that evaluator has been
performing:

- **Performance** — pass rate (or average score for LLM judges), evaluation count, and a
  pass-rate trend over the chosen time range.
- **Score distribution** — a bar per score (Terrible → Excellent). **Click a bar to filter
  the recent-evaluations table** to just that score; click it again, or use the chip in the
  table header, to clear the filter.
- **Attached to** — the test suites and agents that use this evaluator. **Click any suite or
  agent to jump to it.**
- **Recent evaluations** — the latest results this evaluator scored. **Click a row to open
  that result in the run matrix**, with its detail drawer expanded.

## Reading evaluations

After a run, each test result carries one evaluation per evaluator. Use these to compare
agent versions and to feed [optimization proposals](/guide/optimization-proposals).
