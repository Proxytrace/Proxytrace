---
name: project-insights
description: Project-wide dashboard statistics, model providers, and individual traces. Load when the user asks for overall stats/usage/cost, about a provider, or to inspect a specific captured trace.
tools: get_dashboard_stats, get_provider, get_trace
---

# Skill: Project insights

Cross-cutting reads that aren't tied to a single agent or suite.

- `get_dashboard_stats` — aggregate project figures (calls, tokens, latency, cost, pass rate).
  Render as a `show_chart` for trends/comparisons or a `show_table` for a small grid; lead with the
  component, then one sentence of insight.
- `get_provider` — a single model provider's details (renders a clickable card).
- `get_trace` — a single captured trace (agent call) with model, status, token usage, latency, and
  cost (renders a clickable card). Use it to inspect one specific call the user points you at.

Never invent ids or numbers — fetch them first, then render rather than describe.
