# Proxytrace

**Observability, evaluation, and continuous improvement for production AI agents.**

Proxytrace is an enterprise AI agent observability platform that captures every LLM interaction through an OpenAI-compatible proxy, enables teams to curate production traces into rigorous benchmark test suites, and generates data-driven optimization proposals — closing the feedback loop between deployment and improvement.

---

## The Problem

Production AI agents are largely black boxes. Teams ship prompt changes, tweak tool definitions, and swap model parameters with no systematic way to measure impact, catch regressions, or prove that a change made things better. Traditional software engineering disciplines — instrumentation, regression testing, iterative optimization — have not yet been fully applied to agent development.

Proxytrace bridges that gap.

---

## How It Works

```
                  ┌──────────────────────────────────────────────┐
                  │                                              │
  Your Agent  ──► │  OpenAI-Compatible Proxy  (Proxytrace)             │  ──► LLM Provider
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

### The Workflow

1. **Route traffic through Proxytrace.** Point any OpenAI-compatible client at Proxytrace's proxy endpoint. No SDK changes, no code modifications — a single base URL change is all that is required.

2. **Automatic trace capture.** Every LLM call is captured in full: message history, tool definitions, model parameters, provider, latency, and the complete response. No instrumentation code required.

3. **Automatic agent detection.** Proxytrace extracts and tracks agent definitions from your traces — system prompt, tool set, model, provider, and parameters — and versions them automatically as they evolve over time.

4. **Curate traces into test suites.** Promote production traces that represent critical behaviors, edge cases, or regression scenarios into durable, reproducible benchmark test suites.

5. **Run structured evaluations.** Execute test suites against any agent version. Proxytrace computes evaluation metrics per test case and tracks results over time, giving teams a concrete, comparable signal for every change.

6. **Receive targeted optimization proposals.** Grounded in evaluation results and trace data, Proxytrace generates specific, actionable suggestions for improving system prompts and tool definitions.

---

## Core Concepts

| Concept | Description |
|---|---|
| **Trace** | A fully captured agent invocation: messages, tools, model, parameters, provider, and response. |
| **Agent** | A versioned definition extracted from traces: system prompt, tool set, model, provider, and parameter history. |
| **Test Suite** | A curated, reproducible benchmark composed of test cases derived from production traces. |
| **Test Case** | A single input/expected-output pair used to evaluate an agent's behavior. |
| **Test Run** | An execution of a test suite against a specific agent version, producing per-case evaluations and aggregate metrics. |
| **Evaluator** | A configurable scoring function that grades agent responses against expected outputs. |
| **Optimization Proposal** | A data-driven recommendation for improving an agent's system prompt or tool definitions, grounded in test run outcomes. |
| **Project / Organization** | Organizational constructs for grouping agents, test suites, runs, and team members across an enterprise. |

---

## Current Status

Proxytrace is in **early architecture phase**.

The foundational data model, layered backend architecture, and OpenAI proxy integration are actively being established. The full entity graph and API surface underpinning the trace-to-optimization loop — agents, test suites, test runs, evaluators, and optimization proposals — are defined and taking shape. Every capability built going forward depends on this foundation.

---

## Getting Started

### Prerequisites

- .NET 10 SDK
- Node.js 22+ (for the frontend)
- A supported database (SQLite recommended for local development)

### Database Configuration

Proxytrace supports multiple database providers with automatic detection based on the connection string:

| Provider | Use Case | Connection String |
|---|---|---|
| **SQLite** | Local development (recommended) | `Data Source=proxytrace.db` |
| **PostgreSQL** | Production, open-source deployments | Contains `Host=` or `Port=` |
| **SQL Server** | Enterprise deployments | All other formats |

For a zero-configuration local setup, update `Proxytrace.Api/appsettings.json`:

```json
{
  "ConnectionStrings": {
    "Default": "Data Source=proxytrace.db"
  }
}
```

See [DATABASE.md](DATABASE.md) for full configuration details and migration instructions.

### Running Locally

```bash
# Start backend (port 5001) + frontend (port 4201) with demo data
./dev.sh
```

Or start services individually:

```bash
# Backend
cd Proxytrace.Api && dotnet run

# Frontend
cd frontend && npm install && npm start
```

Swagger UI is available at `http://localhost:5001/swagger` in Development mode.

---

## Roadmap

- OpenAI proxy ingestion pipeline with complete trace capture
- Agent detection and automatic version tracking from traces
- Test suite builder: promote production traces to test cases
- Test run execution with configurable evaluator-based scoring
- Metrics dashboards and comparison views across test runs
- Optimization proposal generation for system prompts and tool definitions
- Self-hosted deployment via Docker

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | C# / .NET 10, ASP.NET Core |
| **Database** | PostgreSQL, SQL Server, or SQLite via Entity Framework Core |
| **Frontend** | Angular 21, Tailwind CSS 4 |
| **Deployment** | Docker (self-hosted or cloud-hosted) |

---

## Who Proxytrace Is For

- **AI engineering teams** moving from intuition-based iteration to systematic, measurement-driven improvement
- **Platform and infrastructure teams** that need observability and regression coverage across an agent fleet
- **Organizations** requiring audit trails, traceability, and accountability for production LLM usage
