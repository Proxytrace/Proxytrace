#!/usr/bin/env bash
set -euo pipefail

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.e2e.yml"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo "==> Tearing down any existing e2e stack (removing volumes)..."
$COMPOSE down -v

echo "==> Building and starting the e2e stack..."
$COMPOSE up --build -d --wait

echo "==> Running Playwright tests..."
cd "$SCRIPT_DIR"

# Load e2e/.env (OPENAI_API_KEY, OPENAI_BASE_URL, LLM_MODEL) into the Playwright process so the
# @llm specs run instead of skipping, and so setup seeds the provider with the real upstream key.
if [ -f "$SCRIPT_DIR/.env" ]; then
  echo "==> Loading e2e/.env"
  set -a
  # shellcheck disable=SC1091
  . "$SCRIPT_DIR/.env"
  set +a
fi

npm install --silent
npx playwright install chromium

EXIT_CODE=0
npx playwright test "$@" || EXIT_CODE=$?

echo "==> Tearing down e2e stack..."
cd "$ROOT_DIR"
$COMPOSE down -v

exit $EXIT_CODE
