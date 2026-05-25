# Installation

This section is for operators self-hosting Proxytrace. For using the product, see the
[User Guide](/guide/getting-started).

## Prerequisites

- **.NET 10 SDK**
- **Node.js 20+** (for the frontend)
- A supported **database** — SQLite needs zero configuration and is the local default. See
  [Database](/admin/database).

## Run everything (recommended for local)

From the repository root:

```bash
./dev.sh
```

This starts:

- **Backend** on `http://localhost:5001`
- **Frontend** on `http://localhost:4201`
- **Swagger** (Development only) on `http://localhost:5001/swagger`

It installs frontend dependencies if needed and seeds demo data on first run.

::: tip Split mode
`SPLIT=1 ./dev.sh` runs the production-shaped split — a standalone ingestion proxy, the
app, and Redis — so agent traffic flows through the standalone proxy. It requires Docker
(used to run a throwaway Redis). See [Deployment](/admin/deployment).
:::

## Run services individually

```bash
# Backend
cd Proxytrace.Api && dotnet run

# Frontend
cd frontend && npm install && npm run dev
```

## Build and test

```bash
dotnet restore Proxytrace.sln   # restore packages
dotnet build Proxytrace.sln     # build all projects
dotnet test Proxytrace.sln      # run all tests
```

Frontend (inside `frontend/`):

```bash
npm install
npm run build    # production build + type-check
npm run lint     # ESLint
npm test         # Vitest unit tests
```

## Next step

Configure the application — see [Configuration](/admin/configuration).
