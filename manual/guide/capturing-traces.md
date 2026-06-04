# Capturing Traces

A **trace** (internally an *Agent Call*) is one fully captured LLM interaction. Once your
client routes through the [proxy](/guide/proxy-setup), every call is recorded
automatically.

## What a trace contains

- The full **message history** sent to the model (system, user, assistant, tool messages).
- The **tool definitions** available to the agent for that call.
- **Model parameters** (model name, temperature, etc.).
- The **provider** the call was routed to.
- **Latency** and **token usage** (with per-token cost from the model endpoint).
- The model's **response**, including any tool requests.

## Exploring traces

Open **Traces** in the sidebar to browse captured calls. Real-time updates stream in via
Server-Sent Events, so new traces appear as your agents run — no refresh needed.

Typical things you can do:

- Inspect a single trace end to end: the conversation, the tools offered, and the response.
- Filter and search across captured calls to find specific behaviors or regressions.
- Identify traces worth promoting into a benchmark — see
  [Test Suites & Cases](/guide/test-suites-and-cases).

### Filtering, search, and paging

- **Agent cards** at the top let you focus on one agent. Only agents that actually have
  traces in the selected time range are shown.
- **Search** matches anywhere inside captured message content (and the response), not just
  at the start of a word — searching `efund` finds a trace mentioning `refund`. You can also
  search by model name or the short trace ID.
- **Per page** lets you choose how many traces to show at once (20, 50, 100, or 200). The
  total trace count for the current filter is shown alongside the pager.

### Multi-turn conversations

Calls that share a conversation are grouped into a single collapsible row. The group's
leading **turns** badge shows how many calls it contains; click the row to expand the
individual turns. The group's status column shows the exact code (e.g. `200`) when every
turn shares it, `2xx` when all turns succeeded with differing 2xx codes, and `mixed` when
the turns disagree.

## From traces to everything else

Traces are the raw material for the rest of Proxytrace:

- **Agents** are detected from traces — see [Agents](/guide/agents).
- **Test cases** are curated from traces — see
  [Test Suites & Cases](/guide/test-suites-and-cases).
- **Optimization proposals** are grounded in trace and evaluation data — see
  [Optimization Proposals](/guide/optimization-proposals).
