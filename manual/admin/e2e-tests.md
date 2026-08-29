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

## Support key

The e2e overlay injects a committed throwaway Enterprise **support key** (`PROXYTRACE_LICENSE` in
`docker-compose.e2e.yml`) so the suite can assert the "contract on file" path (the top-bar chip and
`GET /api/license`). Nothing is gated on it — every feature is available with or without a key. It
is an ES256 token signed with a test private key whose public half is baked into the e2e images via
the `LICENSE_PUBLIC_KEY` build-arg; production images embed a different key and reject it. No action
is needed to run the suite; this is purely informational.

## Compose ports (e2e overlay)

| Service  | Host port | Purpose |
|----------|-----------|---------|
| nginx (frontend) | 5101 | Playwright base URL |
| api | 5100 | REST / SSE |
| proxy | 5102 | OpenAI-compatible ingestion endpoint |
| postgres | 5432 | Database (fresh per run) |
| redis | 6379 | Ingestion transport |

## Test projects

The suite runs single-worker (`workers: 1`) because every spec shares one database and a few
assume ordering. Projects:

| Project | Covers | Auth | LLM |
|---------|--------|------|-----|
| `setup` | first-admin + initial setup, saves browser storageState | — | no |
| `core` | all CRUD/UI flows: providers, agents, suites, traces, evaluators, dashboard, settings, admin, proposals (seeded), the support key, error handling | storageState | no |
| `smoke` | every main route loads clean | storageState | no |
| `auth-flows` | login/logout/signup/access-control from a clean session | **no** storageState | no |
| `llm-ingestion` / `llm-proxy-trace` | real proxy call → trace in Traces UI | storageState | yes |
| `llm-test-run` / `llm-playground` / `llm-evaluator-playground` | runs, playground, agentic test bench | storageState | yes |

Non-LLM coverage (`core`, `smoke`, `auth-flows`) runs in CI on every PR; the `llm-*` projects
run only when `OPENAI_API_KEY` is present.

```bash
cd e2e
npx playwright test --project=smoke
npx playwright test --project=core
npx playwright test --project=auth-flows
npx playwright test --project=llm-ingestion --project=llm-test-run   # needs OPENAI_API_KEY
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
