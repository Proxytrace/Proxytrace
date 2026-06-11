# Installation

This section is for operators self-hosting Proxytrace. For using the product, see the
[User Guide](/guide/getting-started).

## Install with Docker Compose (recommended)

Proxytrace ships as versioned container images on GHCR
(`ghcr.io/proxytrace/proxytrace-{api,proxy,frontend}`) together with a ready-to-run
Docker Compose deployment. Each [GitHub release](https://github.com/Proxytrace/Proxytrace/releases)
attaches a `proxytrace-<version>.zip` containing a compose file pinned to that release,
an `.env` template, and a quickstart README.

### Prerequisites

- **Docker** with the Compose plugin. That's it — PostgreSQL and Redis run as part of the stack.

### Quickstart

```bash
# 1. Download and unpack the deployment artifact from the latest release
unzip proxytrace-<version>.zip && cd proxytrace-<version>

# 2. Create your configuration (the template documents every value)
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD and PROXYTRACE_SIGNING_KEY (generation hints inside)

# 3. Start the stack
docker compose up -d
```

Open `http://localhost:5101` and follow the first-run setup to create the admin account.
This manual is served by your installation at `http://localhost:5101/docs`.

Point your agents' OpenAI base URL at the ingestion proxy to start capturing traces:
`http://localhost:5102/openai/v1` — see [Capturing Traces](/guide/capturing-traces).

### What the stack runs

| Service | Image | Purpose |
|---|---|---|
| `frontend` | `proxytrace-frontend` | Web UI (nginx) — serves the app, this manual, and proxies `/api` |
| `api` | `proxytrace-api` | REST API, test runner, optimizer, ingestion consumer |
| `proxy` | `proxytrace-proxy` | OpenAI-compatible ingestion proxy your agents call |
| `postgres` | `postgres:16-alpine` | Database (internal only) |
| `redis` | `redis:7-alpine` | Ingestion transport (internal only) |

Database schema migrations apply automatically when the `api` container starts — both on
first install and on upgrades. See [Upgrading](/admin/upgrading).

### License

Without `PROXYTRACE_LICENSE` set, Proxytrace runs the Free tier. Enter your license key in
`.env` and run `docker compose up -d` to apply it. A *malformed* license token stops the app
from starting — see [Licensing](/admin/licensing).

## Run from source (development)

For development or evaluation from a repository checkout you need the **.NET 10 SDK**,
**Node.js 20+**, and (for persistent runs) **PostgreSQL** — or use kiosk mode for a
zero-dependency in-memory demo (see [Database](/admin/database)).

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

### Run services individually

```bash
# Backend
cd Proxytrace.Api && dotnet run

# Frontend
cd frontend && npm install && npm run dev
```

### Build and test

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
