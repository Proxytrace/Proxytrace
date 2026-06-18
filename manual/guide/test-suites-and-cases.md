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

## The suites page

![The Test Suites page: summary totals across the top, a selectable suite list on the left, and the selected suite's detail panel on the right.](/screenshots/suites/overview.png)

The page is a **master–detail view**: a list of suites on the left and the selected
suite's detail on the right. Summary totals sit across the top, and the **Agent** filter
narrows the list to a single agent — it only lists agents that actually own a suite, so it
stays usable no matter how many agents the project has. Each list entry shows the suite's
case count, latest pass rate, and when it last ran. **+ New suite** opens the
[creation wizard](#creating-a-suite).

## Suite statistics

The detail panel reports the suite's run statistics for a selectable **time window**
("bucket"): **Last run**, the **last 7 days**, the **last 30 days**, or **all time**.
For the chosen window it shows the **pass rate**, the **number of runs**, the **average
run duration**, and the **total cost**.

## Test cases

![A suite's detail panel: its test cases on the left and the selected case's input with its editable expected output on the right.](/screenshots/suites/cases.png)

Each test case captures the input to run and the expectation to check against. What
"expected" means depends on the [evaluators](/guide/evaluators) attached to the suite —
an exact string, a number within tolerance, a JSON shape, a tool that should be called,
and so on.

In the detail panel's **Test Cases** tab you can curate the suite directly: switch to
**Add from traces** to promote more agent calls into cases, remove a case, or select a
case to edit its expected output. Edits are staged and applied together with **Save
changes**.

## Editing the expected output

The captured response is only a starting point. When the traced output is *not* what you
want the agent to produce — you intend to change the agent to hit a target — edit the
expected output directly:

- **In the Promote dialog**, the *Expected output* section is editable before you add the
  case to a suite.
- **In the suite detail panel**, select a case and choose **Edit expected output** to revise
  an existing case.

The editor offers two mutually exclusive types:

- **Text response** — the assistant's plain-text answer.
- **Tool request** — one or more tool calls the agent should make. Pick a tool name
  (the agent's declared tools are suggested, but any name is allowed) and supply the call
  **arguments as JSON**. Add or remove tool requests as needed. Saving is blocked until the
  text is non-empty or every tool request has a name and valid JSON arguments.

## Attaching evaluators

A test suite has a many-to-many relationship with **evaluators**: one suite can score its
cases with several evaluators, and an evaluator can be reused across suites. Choose the
evaluators that express what "correct" means for the suite in the detail panel's
**Evaluators** tab. See [Evaluators](/guide/evaluators).

## Scheduling runs

From the detail panel you can also configure the suite's **schedules** — recurring runs on
a fixed interval against a chosen set of model endpoints. Create, edit, pause/resume, and
delete a suite's schedules inline. Scheduled runs require an Enterprise license; see
[Running tests](/guide/running-tests).

## Creating a suite

**+ New suite** opens a step wizard: pick the agent, select traces to seed cases, name the
suite, and choose evaluators.

## Running a suite

Once a suite has cases and evaluators, run it against an
[agent](/guide/agents) version to produce a [test run](/guide/running-tests). **Run now**
(or **Run again**) lives in the detail panel header.
