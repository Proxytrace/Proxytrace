#!/usr/bin/env bash
# Point git at the versioned hooks in scripts/git-hooks.
# Currently: pre-commit secret scan (gitleaks, config in .gitleaks.toml).
set -euo pipefail

cd "$(dirname "$0")/.."
git config core.hooksPath scripts/git-hooks
echo "core.hooksPath -> scripts/git-hooks"

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "note: gitleaks is not installed; the pre-commit scan will be skipped until it is."
  echo "      https://github.com/gitleaks/gitleaks#installing"
fi
