#!/usr/bin/env bash
set -euo pipefail

echo "=== Proxytrace devcontainer post-create ==="

# Restore .NET local tools (dotnet-ef etc.)
dotnet tool restore

# Restore solution
dotnet restore Proxytrace.sln

# Install frontend deps
if [ -d frontend ]; then
    (cd frontend && npm install)
fi

chmod +x dev.sh || true

echo ""
echo "Setup complete."
echo "  Backend:  cd Proxytrace.Api && dotnet run"
echo "  Frontend: cd frontend && npm run dev"
echo "  Both:     ./dev.sh"
