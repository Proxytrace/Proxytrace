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

Runs stream their progress live via Server-Sent Events, without refreshing the page. You see
the run unfold at two levels of detail:

- In the **test case matrix**, an in-flight case shows a pulsing indicator with the evaluators
  that have reported so far (e.g. `2/3`) — so a long-running case isn't a blank cell.
- In the **evaluator breakdown**, each evaluator's score distribution grows as its individual
  judgements arrive, not only when a whole case finishes.

Pass rate is always shown over the cases **judged so far**, so the live number matches the
final one as it climbs — it never starts near zero and jumps at the end. Related runs can be
grouped together (a **test run group**) so you can compare, for example, the same suite across
several agent versions.

### A/B validation runs

When the optimizer validates an [optimization theory](/guide/optimization-theories), it
executes ephemeral **A/B runs** (baseline vs. candidate). These are hidden from the run list
by default to keep it focused on the runs you started. Toggle **A/B runs** above the list to
reveal them; revealed groups are tagged with an **A/B** badge. Opening a proposal's or
theory's *View run* link also reveals the linked A/B run automatically and selects it.

## Reading results

A completed run gives you:

- **Test case matrix** — one row per case, one column per endpoint, showing each
  evaluator's verdict and latency. The same table layout is used whether you ran against
  a single endpoint or several, so divergent rows are easy to spot when comparing models.
  Click any cell or row to open the full input/output and evaluator detail.
- **Aggregate metrics** — pass rates and scores rolled up across the suite.
- **Comparisons** — how this run stacks up against previous runs of the same suite.

When you open a case, each model column has a **Request** button. It shows the exact
request that run sends to the model — the resolved model name, the full message list (with
the agent's system prompt merged in), and the **tool definitions** the model receives. Use
it to confirm the agent is offering the tools a case expects; if a tool is missing here, the
model can't call it. The request is rebuilt on demand from the agent's current configuration,
so it reflects what a re-run would send.

## What runs feed into

Test runs are the evidence behind
[optimization proposals](/guide/optimization-proposals): a proposal references the specific
runs that justify it.
