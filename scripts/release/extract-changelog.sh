#!/usr/bin/env bash
# Extracts one version's section from CHANGELOG.md (Keep a Changelog format).
# Used by the release workflow both as a tag-time guard (a release tag without a
# matching changelog section fails fast) and as the GitHub release notes source.
#
# Usage: extract-changelog.sh <version> [changelog-file]
#   e.g. extract-changelog.sh 1.2.3
set -euo pipefail

version="${1:?usage: extract-changelog.sh <version> [changelog-file]}"
file="${2:-CHANGELOG.md}"

# Print everything between "## [<version>]" and the next "## [" heading.
# Prefix match (not regex) so dots in the version can't match arbitrary characters
# and a date suffix ("## [1.2.3] - 2026-06-11") still matches.
notes=$(awk -v ver="$version" '
    index($0, "## [" ver "]") == 1 { found = 1; next }
    found && /^## \[/ { exit }
    found { print }
' "$file")

if [ -z "${notes//[[:space:]]/}" ]; then
    echo "error: no changelog section for version $version in $file" >&2
    echo "Add a \"## [$version]\" section (move the [Unreleased] content) before tagging." >&2
    exit 1
fi

printf '%s\n' "$notes"
