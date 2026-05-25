# Proxytrace

**Observability, evaluation, and continuous improvement for production AI agents.**

Proxytrace is an AI agent observability platform that acts as an OpenAI-compatible proxy. It captures every LLM interaction your agents make, lets teams curate those traces into reproducible benchmark test suites, runs structured evaluations against any agent version, and generates data-driven proposals for improving system prompts and tooling — closing the loop between deployment and improvement.

> **Status:** early architecture phase. The data model, layered backend, OpenAI proxy, and frontend are actively being built out.

---

## The Problem

Production AI agents are mostly black boxes. Teams change prompts, tweak tool definitions, and swap models with no systematic way to measure impact, catch regressions, or prove a change helped. Proxytrace brings the disciplines of software engineering — instrumentation, regression testing, iterative optimization — to agent development.

---

## How It Works

```
  Your Agent  ──►  OpenAI-Compatible Proxy (Proxytrace)  ──►  LLM Provider
                   captures prompt, tools, params, response
                            │
                            ▼
                     Trace Storage
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
          Test Suites            Agent Definitions
       (curated from traces)   (detected from traces)
                │
                ▼
            Test Runs  ──►  Evaluations + Metrics
                │
                ▼
        Optimization Proposals
   (system prompt + tool suggestions)
```

1. **Route traffic through Proxytrace.** Point any OpenAI-compatible client at the proxy endpoint — a single base-URL change, no SDK or code modifications.
2. **Automatic trace capture.** Every call is captured in full: message history, tool definitions, model parameters, provider, latency, and response.
3. **Automatic agent detection.** Agent definitions (system prompt, tools, model, provider) are extracted from traces and versioned as they evolve.
4. **Curate traces into test suites.** Promote production traces representing critical behaviors or regression scenarios into durable benchmark test suites.
5. **Run structured evaluations.** Execute suites against any agent version. Configurable evaluators score each test case; results are tracked over time.
6. **Receive optimization proposals.** Grounded in evaluation results and trace data, Proxytrace suggests concrete improvements to prompts and tool definitions.

---

## Core Concepts

| Concept | Description |
|---|---|
| **Trace (AgentCall)** | A fully captured agent invocation: messages, tools, model, parameters, provider, response. |
| **Agent** | A definition extracted from traces: system prompt, tool set, endpoint (model + provider), project. |
| **Test Suite / Test Case** | A curated, reproducible benchmark and its individual input/expected-output cases. |
| **Test Run** | Execution of a suite against an agent, producing per-case evaluations and aggregate metrics. |
| **Evaluator** | A configurable scoring function (exact match, numeric, JSON schema, tool usage, helpfulness, safety, and LLM-based agentic evaluators). |
| **Optimization Proposal** | A data-driven recommendation (e.g. switch model, update system prompt) grounded in test run evidence. |
| **Model Endpoint** | A model paired with a provider, with per-token cost tracking. |
| **Project / User** | Tenancy constructs grouping agents, suites, runs, and keys. |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | C# / .NET 10, ASP.NET Core, Autofac DI |
| **Database** | SQLite, PostgreSQL, or SQL Server via Entity Framework Core (provider auto-detected) |
| **Frontend** | React 19 + Vite + TypeScript, TanStack Query v5, React Router 7, Tailwind CSS 4 |
| **Real-time** | Server-Sent Events (SSE) for live traces, test results, and proposals |
| **Deployment** | Docker Compose (self-hosted) |

---

## Architecture

Strict layered dependency flow — each layer depends only on layers below it:

```
Proxytrace.Api  →  Proxytrace.Application  →  Proxytrace.Domain  →  Proxytrace.Common
            →  Proxytrace.Infrastructure  →  Proxytrace.Serialization
            →  Proxytrace.Storage
```

- **Proxytrace.Api** — ASP.NET Core controllers, DTOs, the OpenAI-compatible proxy endpoint, composition root.
- **Proxytrace.Application** — Use-case orchestration: ingestion, test running, optimization, SSE broadcasters, demo seeding.
- **Proxytrace.Domain** — Business entities, interfaces, value objects, repository contracts. Pure C#, no I/O.
- **Proxytrace.Infrastructure** — External service integration; `ModelClient` invokes LLMs via `Microsoft.Extensions.AI` + the OpenAI SDK.
- **Proxytrace.Serialization** — JSON serializers and output formats.
- **Proxytrace.Storage** — EF Core entities, configurations, mappers, migrations.
- **Proxytrace.Common** — Shared utilities.
- **frontend/** — React 19 + Vite SPA, served from the API's `wwwroot/` in production.

DI is wired with Autofac; each project ships a `Module : Autofac.Module`. See [CLAUDE.md](CLAUDE.md) for the full domain entity pattern and conventions.

---

## Getting Started

### Prerequisites

- .NET 10 SDK
- Node.js 20+ (for the frontend)
- A supported database — SQLite needs zero config and is the local default

### Run everything (recommended)

```bash
./dev.sh
```

Starts the backend on **:5001** and the frontend on **:4201**, installs frontend deps if needed, and seeds demo data on first run.

- Frontend: http://localhost:4201
- Backend: http://localhost:5001
- Swagger (Development): http://localhost:5001/swagger

### Run services individually

```bash
# Backend
cd Proxytrace.Api && dotnet run

# Frontend
cd frontend && npm install && npm run dev
```

### Database configuration

Provider is auto-detected from the connection string in `Proxytrace.Api/appsettings.json`:

| Provider | Connection string pattern |
|---|---|
| SQLite | `Data Source=proxytrace.db` or `:memory:` |
| PostgreSQL | contains `Host=` or `Port=` |
| SQL Server | anything else |

SQLite uses code-first initialization; migrations are supported for SQL Server and PostgreSQL. See [DATABASE.md](DATABASE.md) for details.

---

## Common Commands

### Backend (.NET 10)

```bash
dotnet restore Proxytrace.sln       # Restore packages
dotnet build Proxytrace.sln         # Build all projects
dotnet test Proxytrace.sln          # Run all tests
dotnet test Proxytrace.Domain.Tests # Run a single test project
```

### Frontend (inside `frontend/`)

```bash
npm install
npm run dev      # Dev server on http://localhost:4201
npm run build    # Production build + type-check
npm run lint     # ESLint
npm test         # Vitest unit tests
```

---

## Docker

```bash
docker compose up --build          # API on :5100, frontend on :5101
docker compose -f docker-compose.kiosk.yml up --build   # Kiosk mode, API :5200, frontend :5201
```

---

## Documentation

- **User & operator manual** — a searchable HTML manual built from markdown in [`manual/`](manual/)
  (VitePress). It is served by the app at **`/docs`** in both deployment shapes. Run it
  locally with `cd manual && npm install && npm run docs:dev` (http://localhost:4202).
- [CLAUDE.md](CLAUDE.md) — architecture, conventions, and the domain entity pattern
- [DATABASE.md](DATABASE.md) — database providers and migrations
- [frontend/DESIGN.md](frontend/DESIGN.md) — frontend visual system
- [frontend/BEST_PRACTICES.md](frontend/BEST_PRACTICES.md) — frontend code architecture

---

## Who Proxytrace Is For

- **AI engineering teams** moving from intuition-based iteration to measurement-driven improvement.
- **Platform teams** needing observability and regression coverage across an agent fleet.
- **Organizations** requiring audit trails and accountability for production LLM usage.
