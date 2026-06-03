---
name: test-suites-and-runs
description: Inspect test suites and runs, and start a test run. Load when the user asks about their suites, test runs, results/pass rates, or wants to run a suite against an agent.
tools: list_suites, get_suite, list_runs, get_run, start_test_run
---

# Skill: Test suites & runs

Work with the project's benchmark suites and their executions.

## Read

- `list_suites` — the suites in the project; `get_suite` for one suite's cases and evaluators.
- `list_runs` — recent runs; `get_run` for a single run's per-case results and pass rate.

Render results, don't narrate them: a single suite or run → its entity card (`get_suite` /
`get_run` render clickable cards); a comparison of runs or pass rates over time → `show_chart` /
`show_table`. Add at most a sentence of insight.

## Start a run

`start_test_run` runs a suite against an agent's endpoint. It is **confirmation-gated** — the app
shows a Confirm/Cancel card; call the tool and surface the result. You need both a `suiteId`
(`list_suites`) and an `agentId` (the agent is available via the core `list_agents` / `get_agent`).
If either is ambiguous, disambiguate with `ask_questions` before starting.

To go beyond a single run and actually *improve* an agent from its results, load the
`optimize-agent` skill instead.
