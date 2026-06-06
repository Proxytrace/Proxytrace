<div align="center">

<img src="frontend/public/icon.svg" alt="Proxytrace" width="96" height="96" />

# Proxytrace

### Observability, evaluation, and continuous improvement for production AI agents.

Drop-in OpenAI-compatible proxy that captures every LLM interaction, turns real traces
into reproducible benchmarks, scores agents against them, and proposes data-driven
improvements — closing the loop between **deployment** and **optimization**.

<br />

[![.NET 10](https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/DB-PostgreSQL-336791?logo=postgresql&logoColor=white)](DATABASE.md)
![Status: early architecture](https://img.shields.io/badge/status-early%20architecture-c9944a)
[![License: Proprietary](https://img.shields.io/badge/license-proprietary-red)](LICENSE)

<br />

<img src="frontend/src/assets/hero.png" alt="Proxytrace captures every agent call as a trace" width="280" />

</div>

---

## Why Proxytrace

Production AI agents are mostly black boxes. Teams change prompts, tweak tool definitions,
and swap models with **no systematic way to measure impact, catch regressions, or prove a
change helped**. Proxytrace brings the disciplines of software engineering —
instrumentation, regression testing, iterative optimization — to agent development.

> **Status:** early architecture phase. The data model, layered backend, OpenAI proxy, and frontend are actively being built out.

---

## What You Get

| | |
|---|---|
| **Zero-code capture** | Point any OpenAI-compatible client at the proxy. One base-URL change — no SDK swap, no code rewrite. |
| **Full-fidelity traces** | Every call captured in full: message history, tool definitions, model params, provider, latency, response. |
| **Automatic agent detection** | Agent definitions (prompt, tools, model, provider) extracted from traffic and versioned as they evolve. |
| **Reproducible benchmarks** | Promote real production traces into durable test suites that pin critical behaviors and regression scenarios. |
| **Structured evaluation** | Run suites against any agent version. Exact-match, numeric, JSON-schema, tool-usage, safety, and LLM-based evaluators score every case. |
| **Optimization proposals** | Concrete, evidence-backed suggestions to improve prompts and tooling — grounded in test runs and trace data. |
| **Live updates** | New traces, test results, and proposals stream to the UI in real time over SSE. |
| **Cost tracking** | Per-token input/output cost accounting at the model-endpoint level. |

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

1. **Route traffic through Proxytrace.** Point any OpenAI-compatible client at the proxy endpoint — a single base-URL change.
2. **Automatic trace capture.** Every call is captured in full: messages, tools, parameters, provider, latency, response.
3. **Automatic agent detection.** Agent definitions are extracted from traces and versioned as they evolve.
4. **Curate traces into test suites.** Promote production traces representing critical behaviors into durable benchmarks.
5. **Run structured evaluations.** Execute suites against any agent version; configurable evaluators score each case over time.
6. **Receive optimization proposals.** Grounded in evaluation results and trace data, Proxytrace suggests concrete prompt and tool improvements.

---

## Getting Started

### Prerequisites

- .NET 10 SDK
- Node.js 20+ (for the frontend)
- PostgreSQL (for non-kiosk runs) — or use kiosk mode for a zero-dependency in-memory demo

### Run everything (recommended)

```bash
./dev.sh            # Single-process: backend :5001 + frontend :4201, in-process ingestion
SPLIT=1 ./dev.sh    # Production-shaped split: ingestion proxy :5002 + backend :5001 + Redis + PostgreSQL + frontend :4201
```

Installs frontend deps if needed. `SPLIT=1` boots the standalone `Proxytrace.Proxy` service so
agent traffic flows through the separate ingestion proxy and is published to Redis (requires
Docker for Redis + PostgreSQL); default mode ingests in-process. Neither mode auto-seeds — use
the `/setup` page to populate demo data.

| | URL |
|---|---|
| Frontend | http://localhost:4201 |
| Backend | http://localhost:5001 |
| Swagger (Development) | http://localhost:5001/swagger |
| Docs (manual) | http://localhost:4201/docs/ |
| Ingestion proxy (`SPLIT=1` only) | http://localhost:5002 |

### Run services individually

```bash
# Backend
cd Proxytrace.Api && dotnet run

# Frontend
cd frontend && npm install && npm run dev
```

### Docker

```bash
docker compose up --build                                # API :5100, frontend :5101
docker compose -f docker-compose.kiosk.yml up --build    # Kiosk mode, API :5200, frontend :5201
```

---

## Core Concepts

| Concept | Description |
|---|---|
| **Trace (AgentCall)** | A fully captured agent invocation: messages, tools, model, parameters, provider, response. |
| **Agent / Agent Version** | A definition extracted from traces (system prompt, tool set, endpoint, project); `AgentVersion` snapshots prompt + tools per version so proposals can be applied as new versions. |
| **Test Suite / Test Case** | A curated, reproducible benchmark and its individual input/expected-output cases. |
| **Test Run** | Execution of a suite against an agent, producing per-case evaluations and aggregate metrics. |
| **Evaluator** | A configurable scoring function (exact match, numeric, JSON schema, tool usage, helpfulness, safety, and LLM-based agentic evaluators). |
| **Optimization Theory / Proposal** | A `Theory` is an early-stage agent+suite-scoped hypothesis the optimizer promotes into a concrete, evidence-backed `Proposal` (e.g. switch model, update system prompt). |
| **Model Endpoint** | A model paired with a provider, with per-token cost tracking. |
| **Project / User / Invite** | Tenancy and access: projects group agents/suites/runs/keys; users have roles; `Invite` is a tokenised, expiring email invitation. |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | C# / .NET 10, ASP.NET Core, Autofac DI |
| **Database** | PostgreSQL via Entity Framework Core (in-memory for unit tests and kiosk mode) |
| **Frontend** | React 19 + Vite + TypeScript, TanStack Query v5, React Router 7, Tailwind CSS 4 |
| **Real-time** | Server-Sent Events (SSE) for live traces, test results, and proposals |
| **Ingestion** | In-process channel, or a standalone proxy publishing to Redis Streams (split deployment) |
| **Deployment** | Docker Compose (self-hosted) — API, frontend, PostgreSQL, and (split mode) the proxy + Redis |

---

## Architecture

Strict layered dependency flow — each layer depends only on layers below it:

```
Proxytrace.Api  →  Proxytrace.Application  →  Proxytrace.Domain  →  Proxytrace.Common
            →  Proxytrace.Infrastructure  →  Proxytrace.Serialization
            →  Proxytrace.Storage
            →  Proxytrace.Messaging      (ingestion transport)
            →  Proxytrace.Licensing      (feature/limit gates)

Proxytrace.Proxy  (separate deployable service)
            →  Proxytrace.Domain  →  Proxytrace.Storage (read-only)  →  Proxytrace.Messaging (publish side)
```

- **Proxytrace.Api** — ASP.NET Core controllers, DTOs, composition root; serves the React app and (single-process mode) hosts in-process ingestion.
- **Proxytrace.Proxy** — Standalone OpenAI-compatible reverse-proxy service. Forwards agent traffic to the upstream and publishes each captured call to the ingestion stream. Reads from `Storage` only.
- **Proxytrace.Application** — Use-case orchestration: ingestion (consuming the ingestion stream), test running, optimization, SSE broadcasters, demo seeding.
- **Proxytrace.Domain** — Business entities, interfaces, value objects, repository contracts. Pure C#, no I/O.
- **Proxytrace.Infrastructure** — External service integration; `ModelClient` invokes LLMs via `Microsoft.Extensions.AI` + the OpenAI SDK (optimizer + system agents — not the proxy hot path).
- **Proxytrace.Messaging** — Ingestion transport (`IIngestionStream`) carrying captured calls from proxy → app; in-process (channel) or Redis Streams implementations.
- **Proxytrace.Licensing** — Feature/limit gating (`ILicenseService`, JWT activation, `Free`/`Enterprise` tiers).
- **Proxytrace.Serialization** — JSON serializers and output formats.
- **Proxytrace.Storage** — EF Core entities, configurations, mappers, migrations.
- **Proxytrace.Common** — Shared utilities.
- **frontend/** — React 19 + Vite SPA, served from the API's `wwwroot/` in production.

DI is wired with Autofac; each project ships a `Module : Autofac.Module`. See [CLAUDE.md](CLAUDE.md) for the full domain entity pattern and conventions.

### Database configuration

Persistent storage is PostgreSQL only; set the connection string in `Proxytrace.Api/appsettings.json`:

| Mode | Connection string |
|---|---|
| PostgreSQL (debug/release/e2e) | `Host=localhost;Port=5432;Database=proxytrace;Username=proxytrace;Password=proxytrace` |
| In-memory (unit tests/kiosk) | none — set `Kiosk:Enabled=true` |

PostgreSQL applies EF Core migrations on startup; the in-memory provider uses code-first initialization. See [DATABASE.md](DATABASE.md) for details.

---

## Common Commands

**Backend (.NET 10)**

```bash
dotnet restore Proxytrace.sln       # Restore packages
dotnet build Proxytrace.sln         # Build all projects
dotnet test Proxytrace.sln          # Run all tests
dotnet test Proxytrace.Domain.Tests # Run a single test project
```

**Frontend (inside `frontend/`)**

```bash
npm install
npm run dev      # Dev server on http://localhost:4201
npm run build    # Production build + type-check
npm run lint     # ESLint
npm test         # Vitest unit tests
```

**E2E tests (Playwright, inside `e2e/`)**

Requires Docker. Boots the full compose stack against a throwaway database.

```bash
bash e2e/run.sh                          # Core + smoke tests (no LLM)
OPENAI_API_KEY=sk-... bash e2e/run.sh    # All tests including @llm specs
```

Or run against an already-running stack:

```bash
# Boot the stack once (fresh DB required):
docker compose -f docker-compose.yml -f docker-compose.e2e.yml down -v
docker compose -f docker-compose.yml -f docker-compose.e2e.yml up --build -d --wait

# Then run any subset:
cd e2e && npx playwright test --project=smoke
cd e2e && npx playwright test --project=core
cd e2e && npx playwright test --project=llm   # requires OPENAI_API_KEY
```

See [`e2e/GUIDE.md`](e2e/GUIDE.md) for selectors, auth, polling patterns, and debugging.

---

## Documentation

- **User & operator manual** — a searchable HTML manual built from markdown in [`manual/`](manual/) (VitePress), served by the app at **`/docs`**. Run it locally with `cd manual && npm install && npm run docs:dev` (http://localhost:4202).
- [CLAUDE.md](CLAUDE.md) — architecture, conventions, and the domain entity pattern
- [DATABASE.md](DATABASE.md) — database providers and migrations
- [frontend/DESIGN.md](frontend/DESIGN.md) — frontend visual system
- [frontend/BEST_PRACTICES.md](frontend/BEST_PRACTICES.md) — frontend code architecture

---

## Who Proxytrace Is For

- **AI engineering teams** moving from intuition-based iteration to measurement-driven improvement.
- **Platform teams** needing observability and regression coverage across an agent fleet.
- **Organizations** requiring audit trails and accountability for production LLM usage.

---

## License

Proprietary. Copyright © 2026 Eberharter. All rights reserved. No use, copying,
modification, or distribution is permitted without a written agreement. See
[LICENSE](LICENSE). Licensing inquiries: eberharter@proton.me.
