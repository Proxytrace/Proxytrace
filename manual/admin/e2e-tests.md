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

## Compose ports (e2e overlay)

| Service  | Host port | Purpose |
|----------|-----------|---------|
| nginx (frontend) | 5101 | Playwright base URL |
| api | 5100 | REST / SSE |
| proxy | 5102 | OpenAI-compatible ingestion endpoint |
| postgres | 5432 | Database (fresh per run) |
| redis | 6379 | Ingestion transport |

## Running individual projects

```bash
cd e2e
npx playwright test --project=smoke          # Route smoke tests
npx playwright test --project=core           # CRUD verification
npx playwright test --project=llm            # LLM ingestion + test runs
```

## Viewing the report

```bash
cd e2e && npm run report
```

## Troubleshooting

**Stack does not become healthy:** Check `docker compose -f docker-compose.yml -f docker-compose.e2e.yml logs api` — the most common cause is a port conflict on 5101/5100/5102.

**`setupRequired` is `false`:** The Postgres volume was not removed. Run `docker compose -f docker-compose.yml -f docker-compose.e2e.yml down -v` before re-running.

**LLM specs time out:** The upstream OpenAI API may be rate-limited. Increase `timeout` in `playwright.config.ts` or retry.
