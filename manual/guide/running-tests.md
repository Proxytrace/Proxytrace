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

Runs stream their progress live via Server-Sent Events, without refreshing the page.

The **run header** shows a progress bar with three pieces of information at a glance:
`cases done / total · overall % · estimated time remaining`. The ETA updates continuously
as judgements arrive, so you always know roughly when the run will settle.

In the **test case matrix**, each cell contains one slot per evaluator attached to the suite.
Slots start grey (queued) and fill with color as each evaluator reports back — green for pass,
red for fail, amber for error. You can watch individual judgements land in real time rather
than waiting for every evaluator in a case to finish before anything appears.

Pass rate is always shown over the cases **judged so far**, so the live number tracks
smoothly toward the final value — it never starts near zero and jumps at the end. Related
runs can be grouped together (a **test run group**) so you can compare, for example, the
same suite across several agent versions.

### A/B validation runs

When the optimizer validates an [optimization theory](/guide/optimization-theories), it
executes ephemeral **A/B runs** (baseline vs. candidate). These are hidden from the run list
by default to keep it focused on the runs you started. Toggle **A/B runs** above the list to
reveal them; revealed groups are tagged with an **A/B** badge. Opening a proposal's or
theory's *View run* link also reveals the linked A/B run automatically and selects it.

## Reading results

### Test case matrix

![A completed test run: the per-model comparison cards, the evaluator breakdown, and the test-case matrix with per-model pass/fail results.](/screenshots/runs/results.png)

The matrix shows one row per case and one column per model (endpoint). Each cell contains
one slot per evaluator — the same layout is used whether the run targets a single model or
several. Click any cell to open the **comparison drawer**: it shows the case input, each
model's full output, and the per-evaluator verdicts side by side, so divergent behaviour is
easy to spot without leaving the page.

Each model column also has a **Request** button. It shows the exact request that run sends to
the model — the resolved model name, the full message list (with the agent's system prompt
merged in), and the **tool definitions** the model receives. Use it to confirm the agent is
offering the tools a case expects; if a tool is missing here, the model can't call it. The
request is rebuilt on demand from the agent's current configuration, so it reflects what a
re-run would send.

### Per-model performance summary

![The per-model performance summary comparing two models — pass rate, duration, cost, and tokens — with Fast / Cheap / Best winner badges.](/screenshots/runs/per-model.png)

Every run — single-model and multi-model alike — includes a **per-model performance summary**
below the matrix. It shows pass rate, average latency, and cost for each model in the run.
The numbers update live while the run is in progress.

**Best / Fast / Cheap** winner badges and comparative coloring (highlighting which model won
each metric) appear only once the entire run group has finished. During an active run the
summary is visible but stays neutral — no model is crowned a winner until all results are in.

## What runs feed into

Test runs are the evidence behind
[optimization proposals](/guide/optimization-proposals): a proposal references the specific
runs that justify it.
