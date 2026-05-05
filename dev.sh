#!/usr/bin/env bash
# Start backend and frontend together for local development.
# Demo data is seeded automatically when the database is empty.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
    echo ""
    echo "Stopping dev servers..."
    # Kill all child processes in the process group
    kill -- -$$ 2>/dev/null || kill $(jobs -p) 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "=== Trsr Dev Mode ==="

# Install frontend dependencies if node_modules is missing
if [ ! -d "$REPO_ROOT/frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    (cd "$REPO_ROOT/frontend" && npm install)
fi

# Start backend in development mode
echo "Starting backend on http://localhost:5001 ..."
(cd "$REPO_ROOT/Trsr.Api" && ASPNETCORE_ENVIRONMENT=Development dotnet run --urls "http://localhost:5001") &

# Give the backend a moment to bind its port before the frontend proxy tries to connect
sleep 2

# Start frontend dev server
echo "Starting frontend on http://localhost:4201 ..."
(cd "$REPO_ROOT/frontend" && npm run dev -- --port 4201) &

echo ""
echo "Dev servers running:"
echo "  Frontend: http://localhost:4201"
echo "  Backend:  http://localhost:5001"
echo "  Swagger:  http://localhost:5001/swagger"
echo ""
echo "Demo data is seeded automatically on first run."
echo "Press Ctrl+C to stop all servers."

wait
