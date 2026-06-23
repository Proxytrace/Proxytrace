#!/usr/bin/env bash
# pick_issue.sh — rank OPEN GitHub issues by priority label, oldest-first tie-break.
#
# Prints a JSON array (highest priority first) to stdout. Element [0] is the pick;
# the rest are runners-up so the caller can see what else was in contention.
#
# Priority tiers (label name, case-insensitive, max across an issue's labels wins):
#   3  priority:high | P0 | critical | urgent | sev1 | highest
#   2  priority:medium | P1 | medium
#   1  priority:low | P2 | P3 | low | minor | trivial
#   0  no priority label
#
# Sort: tier descending, then createdAt ascending (oldest unblocked work first).
#
# Env overrides:
#   REPO            owner/name (default: current repo via gh)
#   LIMIT           how many open issues to fetch (default: 200)
#   EXCLUDE_LABELS  comma list of "do not implement" labels, skipped even though
#                   any open issue is otherwise eligible (default: wontfix,duplicate,invalid)
#
# Each element: {number,title,url,createdAt,labels,assignees,milestone,tier,priorityLabel}
set -euo pipefail

REPO="${REPO:-}"
LIMIT="${LIMIT:-200}"
EXCLUDE_LABELS="${EXCLUDE_LABELS:-wontfix,duplicate,invalid}"

repo_args=()
[ -n "$REPO" ] && repo_args=(--repo "$REPO")

excl_json=$(printf '%s' "$EXCLUDE_LABELS" \
  | jq -R 'split(",") | map(ascii_downcase | gsub("^\\s+|\\s+$";"")) | map(select(length>0))')

gh issue list "${repo_args[@]}" --state open --limit "$LIMIT" \
  --json number,title,url,labels,createdAt,assignees,milestone \
| jq --argjson excl "$excl_json" '
  def tier(name):
    (name | ascii_downcase) as $n
    | if   ($n|test("priority:high|^p0$|critical|urgent|sev1|highest")) then 3
      elif ($n|test("priority:medium|^p1$|^medium$"))                   then 2
      elif ($n|test("priority:low|^p[23]$|^low$|minor|trivial"))        then 1
      else 0 end;
  map(
    . as $i
    | ($i.labels | map(.name)) as $names
    | ($names | map(ascii_downcase)) as $lc
    | {
        number, title, url, createdAt,
        labels: $names,
        assignees: ($i.assignees | map(.login)),
        milestone: ($i.milestone.title),
        tier: ([0] + ($names | map(tier(.))) | max),
        priorityLabel: ([ $names[] | select(tier(.) > 0) ] | first),
        _excluded: ($lc | any(. as $x | $excl | index($x)))
      }
  )
  | map(select(._excluded | not))
  | map(del(._excluded))
  | sort_by([ (3 - .tier), .createdAt ])
'
