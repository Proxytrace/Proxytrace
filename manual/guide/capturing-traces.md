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

## From traces to everything else

Traces are the raw material for the rest of Proxytrace:

- **Agents** are detected from traces — see [Agents](/guide/agents).
- **Test cases** are curated from traces — see
  [Test Suites & Cases](/guide/test-suites-and-cases).
- **Optimization proposals** are grounded in trace and evaluation data — see
  [Optimization Proposals](/guide/optimization-proposals).
