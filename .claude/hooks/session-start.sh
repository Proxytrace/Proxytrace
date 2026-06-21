#!/bin/bash
# SessionStart hook: install the .NET 10 SDK (and restore packages/tools) so that
# `dotnet build`, `dotnet test`, and `dotnet-ef` work in Claude Code on the web.
#
# The repo targets net10.0 (see Directory.Build.props / *.csproj). Remote web
# containers ship without the .NET SDK. The official dotnet-install.sh and the
# Microsoft binary CDNs (builds.dotnet.microsoft.com / aka.ms) are blocked by the
# environment's network policy. Ubuntu 24.04 (noble) ships the .NET 10 SDK in its
# own main/universe repos (package `dotnet-sdk-10.0`), and archive.ubuntu.com /
# security.ubuntu.com are reachable, so we install from there. Container state is
# cached after the hook completes, so subsequent sessions reuse the install.
#
# NOTE: we must run a FULL `apt-get update` first. A partial refresh of only one
# repo leaves the Ubuntu indexes stale, so apt's candidate version points at a
# point release that has already been purged from the pool -> every .deb 404s.
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
  echo "Installing .NET 10 SDK from the Ubuntu apt repositories ..."

  # Full refresh so apt's candidate version matches a .deb still in the pool.
  # The base image carries some unrelated PPAs (deadsnakes, ondrej/php) that fail
  # to refresh; don't let those abort the hook.
  apt-get update || true

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
