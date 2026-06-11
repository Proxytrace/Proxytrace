---
name: project-insights
description: Project-wide dashboard statistics, model providers, and captured traces. Load when the user asks for overall stats/usage/cost, about a provider, or to find or inspect captured traces.
tools: get_dashboard_stats, get_provider, find_traces, get_trace
---

# Skill: Project insights

Cross-cutting reads that aren't tied to a single agent or suite.

- `get_dashboard_stats` — aggregate project figures (calls, tokens, latency, cost, pass rate).
  Its digest also carries `byAgent` and `byModel` usage breakdowns (calls + tokens per agent /
  model) — chart usage comparisons straight from it (`show_chart` / `show_table`); do **not**
  list agents and fetch each one's stats. Lead with the component, then one sentence of insight.
- `get_provider` — a single model provider's details (renders a clickable card).
- `find_traces` — search the captured traces by agent, free text, or HTTP status (newest first).
  Use it to FIND calls — errors, a phrase the user remembers, an agent's recent activity.
- `get_trace` — a single captured trace (agent call) with model, status, token usage, latency, and
  cost (renders a clickable card). Use it to inspect one specific call (often one `find_traces`
  surfaced).

Never invent ids or numbers — fetch them first, then render rather than describe.
