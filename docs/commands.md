# Commands

## Backend (.NET 10)
```bash
dotnet restore Proxytrace.sln          # Restore packages
dotnet build Proxytrace.sln            # Build all projects
dotnet test Proxytrace.sln             # Run all tests
dotnet test Proxytrace.Domain.Tests    # Run a single test project
cd Proxytrace.Api && dotnet run        # Start API on http://localhost:5001
```

Swagger UI is available at `http://localhost:5001/swagger` in Development mode.

The dev backend port is **5001** everywhere: `launchSettings.json`, `dev.sh`, the `Self:BaseUrl`
default, and the `/api` + `/mcp` proxy targets in `frontend/vite.config.ts`. Change one and you must
change all of them, or `npm run dev` proxies to a dead port.

## EF Core Migrations (PostgreSQL-only; supply a Postgres connection string at design time)
```bash
ConnectionStrings__Default="Host=localhost;Port=5432;Database=proxytrace;Username=proxytrace;Password=proxytrace" \
  dotnet ef migrations add <MigrationName> --project Proxytrace.Storage --startup-project Proxytrace.Api
dotnet ef database update --project Proxytrace.Storage --startup-project Proxytrace.Api
```

See [`database.md`](database.md) for full migration details.

## Frontend (React 19 / Vite, inside `frontend/`)
```bash
npm install
npm run dev         # Dev server on http://localhost:4201
npm run build       # Production build
npm test            # Vitest unit tests
```

## All-in-one dev mode
```bash
./dev.sh            # Starts backend (5001) + frontend (4201)
```

The `./dev.sh` flow does not auto-seed; use the `/setup` page (or `SetupController`) to populate demo data.

## Release
```bash
# Cut a release (after moving CHANGELOG [Unreleased] under the new version heading):
git tag -a v1.2.3 -m "Proxytrace 1.2.3" && git push origin v1.2.3

# Build the released image locally (the all-in-one container) with the version injected:
docker build -f deploy/allinone/Dockerfile --build-arg APP_VERSION=1.2.3 -t proxytrace:1.2.3 .

# Run it exactly as a customer would — embedded Postgres/Redis, nothing to configure:
docker run -d --name proxytrace -p 5101:80 -p 5102:8081 -v proxytrace:/data proxytrace:1.2.3

# Run the customer deployment artifact locally (managed Postgres/Redis; .env optional):
cd deploy && docker compose up -d
```

See [`releasing.md`](releasing.md) for the full release pipeline (version SSOT, the single
released image, deploy artifact, changelog discipline).

## End-to-end tests (Playwright, inside `e2e/`)
The e2e suite boots the full stack via Docker Compose (`docker-compose.e2e.yml`).
**Do not run the e2e tests if Docker is not installed** — they require a working Docker daemon and
will fail without one. Check first (e.g. `docker --version` and `docker info`); if Docker is
unavailable, skip the e2e suite and say so. See the `run-e2e-tests` skill for how to execute and
triage them.

## Manual screenshots (Playwright + kiosk stack)
Add or refresh screenshots in the VitePress manual with the `manual-screenshots` skill
(`.claude/skills/manual-screenshots/SKILL.md`). It boots the self-seeded, login-free kiosk stack
(`docker-compose.kiosk.yml`, served at http://localhost:5201), captures with Playwright via
`manual/screenshots/capture-lib.mjs`, embeds the PNGs under `manual/public/screenshots/<page>/`, and
tears the stack down. **Docker required.**
