# Trsr

**The feedback loop for agent engineering.**

Trsr is an intelligent platform for tracing, testing, and optimizing AI agents. It captures every LLM interaction through an OpenAI-compatible proxy, lets you curate those traces into benchmark-style test suites, and generates data-driven optimization suggestions to improve agent behavior over time.

---

## Why Trsr Exists

Building AI agents is easy. Making them *reliably good* is hard.

Most teams start with vibes-based evaluation: they tweak a system prompt, eyeball a few responses, and ship. There's no feedback loop, no regression detection, no systematic way to know if a change made things better or worse.

Trsr is built to close that gap. It gives agent engineering teams the same instrumentation, test rigor, and iterative improvement cycle that software engineers have for traditional code — applied to the specific challenges of LLM-based agents.

---

## How It Works

```
                  ┌──────────────────────────────────────────────┐
                  │                                              │
  Your Agent  ──► │  OpenAI-compatible Proxy (Trsr)              │  ──► LLM Provider
                  │  Captures: prompt, tools, params, response   │
                  │                                              │
                  └──────────────────┬───────────────────────────┘
                                     │
                                     ▼
                              Trace Storage
                                     │
                         ┌───────────┴───────────┐
                         │                       │
                         ▼                       ▼
                   Test Suites            Agent Definitions
               (curated from traces)    (extracted from traces)
                         │
                         ▼
                      Test Runs
                  (evaluations + metrics)
                         │
                         ▼
               Optimization Proposals
            (system prompt + tool suggestions)
```

### Step-by-step

1. **Route your calls through Trsr.** Point your OpenAI-compatible client at Trsr's proxy endpoint. No SDK changes required — just a base URL swap.

2. **Traces are captured automatically.** Every call is logged: messages, tool definitions, model parameters, provider, and the full response.

3. **Trsr identifies your agents.** From traces, Trsr extracts and groups agent definitions — including system prompt, tool set, model, provider, and parameters. It tracks versions as these evolve.

4. **Curate traces into test suites.** Select traces that represent important or edge-case behaviors and promote them into benchmark-style test suites. Each test case anchors an expected input/output contract.

5. **Run evaluations.** Execute test suites against an agent. Trsr computes metrics and tracks results over time, giving you a concrete signal for whether a change regressed or improved behavior.

6. **Receive optimization proposals.** Based on test suite results and evaluation metrics, Trsr generates targeted suggestions for improving system prompts and tool definitions.

---

## Core Concepts

| Concept | Description |
|---|---|
| **Trace** | A captured agent invocation: messages, tools, model, params, provider, and response. |
| **Agent** | A named definition extracted from traces: system prompt, tools, model, provider, parameters, and version history. |
| **Test Suite** | A curated collection of test cases, each derived from a trace, forming a reproducible benchmark. |
| **Test Case** | A single input/expected-output pair used to evaluate an agent. |
| **Test Run** | An execution of a test suite against an agent, producing metrics and per-case evaluations. |
| **Evaluator** | A configurable scoring function that grades agent responses against expected outputs. |
| **Optimization Proposal** | A data-driven suggestion for improving a specific agent's system prompt or tool definitions, grounded in test run results. |
| **Project / Organization** | Organizational constructs for grouping agents, test suites, and members across teams. |

---

## Current Status

Trsr is in an **early architecture phase**.

The core data model, layered backend architecture, and OpenAI proxy integration are being established. The entities and API surface that underpin the trace-to-optimization loop — agents, test suites, test runs, evaluators, and optimization proposals — are defined and taking shape.

This is not yet a runnable product. The foundational work happening now is what every subsequent capability will be built on.

---

## Near-Term Direction

- Complete the OpenAI proxy ingestion pipeline with full trace capture
- Agent detection and version tracking from traces
- Test suite builder: promote traces to test cases
- Test run execution with evaluator-based scoring
- Metrics and comparison views across test runs
- Optimization proposal generation for system prompts and tool definitions
- Self-hosted deployment via Docker

---

## Tech Stack

- **Backend:** C# / .NET 10, ASP.NET Core
- **Database:** PostgreSQL or SQL Server via Entity Framework Core
- **Frontend:** Angular
- **Deployment target:** Docker (self-hosted or cloud-hosted)

---

## Who Trsr Is For

- **AI agent builders** who want to move from intuition-based iteration to systematic improvement
- **Dev teams** shipping LLM-powered features who need regression detection and eval coverage
- **Companies** that need accountability and traceability across their agent fleet
