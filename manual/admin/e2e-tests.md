# Running the E2E Test Suite

Proxytrace ships a Playwright end-to-end test suite in `e2e/` that boots the full production Docker Compose stack against a throwaway database and drives real browser interactions.

## Quick start

```bash
cd e2e
bash run.sh
```

This script:
1. Tears down any existing e2e stack and removes volumes (`docker compose down -v`).
2. Rebuilds and starts the stack (`docker compose up --build -d --wait`).
3. Runs all Playwright tests.
4. Tears the stack down again.

## With LLM specs

Pass an `OPENAI_API_KEY` to enable the gated `@llm` specs that exercise real proxy ingestion and test runs:

```bash
OPENAI_API_KEY=sk-... bash e2e/run.sh
```

Without the key, `@llm` specs are skipped automatically — the rest of the suite still passes.

## Licensing

The e2e overlay injects a committed throwaway Enterprise license (`PROXYTRACE_LICENSE` in
`docker-compose.e2e.yml`) so the suite can exercise paid features such as optimization proposals.
It is an ES256 token (kid `2026-05`) signed with the test private key whose public half is the
active embedded verification key, so it validates in any build configuration with no public-key
override. The keypair is generated for tests only and grants nothing against production, which
ships a different embedded public key. No action is needed to run the suite; this is purely
informational.

To also cover the **Free tier**, the overlay starts a second API (`api-free`) and frontend
(`frontend-free`) with **no license configured** — `LicenseService` falls back to Free. These share
the same database as the Enterprise pair, so the Free stack reuses the admin/project created during
setup. The `licensing` Playwright project points at the Free stack (`:5103`) and asserts the
feature gates the Enterprise stack can never show (the optimization-proposals API returns `402`, the
top-bar badge reads "Free" and links to `/upgrade`, gated routes render the upgrade placeholder).

## Compose ports (e2e overlay)

| Service  | Host port | Purpose |
|----------|-----------|---------|
| nginx (frontend) | 5101 | Playwright base URL (Enterprise) |
| api | 5100 | REST / SSE (Enterprise) |
| proxy | 5102 | OpenAI-compatible ingestion endpoint |
| nginx (frontend-free) | 5103 | Base URL for the `licensing` project (Free tier) |
| api-free | — | Free-tier REST (internal only; reached via `:5103`) |
| postgres | 5432 | Database (fresh per run; shared by both tiers) |
| redis | 6379 | Ingestion transport |

## Test projects

The suite runs single-worker (`workers: 1`) because every spec shares one database and a few
assume ordering. Projects:

| Project | Covers | Auth | LLM |
|---------|--------|------|-----|
| `setup` | first-admin + initial setup, saves browser storageState | — | no |
| `core` | all CRUD/UI flows: providers, agents, suites, traces, evaluators, dashboard, settings, admin, proposals (seeded), error handling | storageState | no |
| `smoke` | every main route loads clean | storageState | no |
| `auth-flows` | login/logout/signup/access-control from a clean session | **no** storageState | no |
| `llm-ingestion` / `llm-proxy-trace` | real proxy call → trace in Traces UI | storageState | yes |
| `llm-test-run` / `llm-playground` / `llm-evaluator-playground` | runs, playground, agentic test bench | storageState | yes |
| `licensing-setup` / `licensing` | Free-tier feature gates on the `:5103` stack | storageState | no |

Non-LLM coverage (`core`, `smoke`, `auth-flows`) runs in CI on every PR; the `llm-*` projects
run only when `OPENAI_API_KEY` is present.

```bash
cd e2e
npx playwright test --project=smoke
npx playwright test --project=core
npx playwright test --project=auth-flows
npx playwright test --project=llm-ingestion --project=llm-test-run   # needs OPENAI_API_KEY
npx playwright test --project=licensing                              # Free stack on :5103
```

## Seeding without an LLM

The `core` specs create agents and captured traces through two **test-only** seed endpoints —
`POST /api/agents/seed` and `POST /api/agent-calls/seed` (mirroring `POST /api/proposals/seed`) —
so CRUD/dashboard/trace flows run without a real upstream call. They are exercised only by the
e2e `ProxytraceApiClient`; production agents/traces still come from proxy ingestion.

## Viewing the report

```bash
cd e2e && npm run report
```

## Troubleshooting

**Stack does not become healthy:** Check `docker compose -f docker-compose.yml -f docker-compose.e2e.yml logs api` — the most common cause is a port conflict on 5101/5100/5102.

**`setupRequired` is `false`:** The Postgres volume was not removed. Run `docker compose -f docker-compose.yml -f docker-compose.e2e.yml down -v` before re-running.

**LLM specs time out:** The upstream OpenAI API may be rate-limited. Increase `timeout` in `playwright.config.ts` or retry.
