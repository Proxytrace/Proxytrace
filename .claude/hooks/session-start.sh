#!/bin/bash
# SessionStart hook: install the .NET 10 SDK (and restore packages/tools) so that
# `dotnet build`, `dotnet test`, and `dotnet-ef` work in Claude Code on the web.
#
# The repo targets net10.0 (see Directory.Build.props / *.csproj). Remote web
# containers ship without the .NET SDK. The official dotnet-install.sh and the
# Microsoft binary CDNs (builds.dotnet.microsoft.com / aka.ms) are blocked by the
# environment's network policy, but the Microsoft apt repo (packages.microsoft.com)
# is reachable, so we install the SDK from there. Container state is cached after
# the hook completes, so subsequent sessions reuse the install.
set -euo pipefail

# Only run in the remote (web) environment; local machines already have the SDK.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

export DOTNET_CLI_TELEMETRY_OPTOUT=1
export DOTNET_NOLOGO=1

# Persist dotnet-friendly env for the rest of the session.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo "export DOTNET_CLI_TELEMETRY_OPTOUT=1"
    echo "export DOTNET_NOLOGO=1"
  } >> "$CLAUDE_ENV_FILE"
fi

# Install the .NET 10 SDK if it isn't already present (idempotent).
if ! command -v dotnet >/dev/null 2>&1 || ! dotnet --list-sdks 2>/dev/null | grep -q '^10\.'; then
  echo "Installing .NET 10 SDK via the Microsoft apt repository ..."

  # Register the Microsoft package repo (no-op if already registered).
  if [ ! -f /etc/apt/sources.list.d/microsoft-prod.list ] && \
     ! ls /etc/apt/sources.list.d/ 2>/dev/null | grep -qi microsoft; then
    curl -fsSL -o /tmp/packages-microsoft-prod.deb \
      https://packages.microsoft.com/config/ubuntu/24.04/packages-microsoft-prod.deb
    dpkg -i /tmp/packages-microsoft-prod.deb
  fi

  # Refresh only the Microsoft repo. The base image carries some unrelated PPAs
  # (deadsnakes, ondrej/php) that fail to refresh; don't let those abort the hook.
  apt-get update \
    -o Dir::Etc::sourcelist="sources.list.d/microsoft-prod.list" \
    -o Dir::Etc::sourceparts="-" \
    -o APT::Get::List-Cleanup="0" || apt-get update || true

  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends dotnet-sdk-10.0
else
  echo ".NET 10 SDK already present, skipping install."
fi

dotnet --info

cd "${CLAUDE_PROJECT_DIR:-.}"

# Restore local tools (dotnet-ef) and solution packages.
dotnet tool restore
dotnet restore Proxytrace.sln

echo "Backend dependencies ready."
