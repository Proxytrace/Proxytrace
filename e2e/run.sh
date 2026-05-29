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
npm install --silent
npx playwright install chromium --with-deps

EXIT_CODE=0
npx playwright test "$@" || EXIT_CODE=$?

echo "==> Tearing down e2e stack..."
cd "$ROOT_DIR"
$COMPOSE down -v

exit $EXIT_CODE
