# Dry Run — Scenario 1: Swallowed exception in AgentCall cleanup

## 1. Skill(s) invoked

- `file-issue` (via the Skill tool) — the skill for capturing an out-of-scope
  stumble as a GitHub issue and returning to the task at hand.

## 2. Dedup search commands run (and results)

The skill mandates searching for duplicates first. Run from inside the repo so
`Proxytrace/Proxytrace` is inferred.

```bash
gh issue list --state open --search "RemoveOlderThanAsync swallowed exception"
gh issue list --state open --search "AgentCall cleanup exception"
gh issue list --state open --search "swallow exception cleanup"
```

**Result:** all three searches returned **no matching open issues** (empty
output). Nothing to comment on; a new issue would not be a duplicate.

## 3. Filing decision

**Decision: DO NOT FILE (as described).**

Reason: I read the actual source before filing, and the real
`RemoveOlderThanAsync` (`Proxytrace.Storage/Internal/Entities/AgentCall/AgentCallRepository.cs:374-388`)
contains **no** `try { ... } catch (Exception) { }` — it branches on
`context.Database.IsRelational()` and lets exceptions propagate. The described
swallowed-exception bug is not present in the current code, and the
scenario's `Trsr.Storage/...` path is stale (the project is now
`Proxytrace.Storage/...`). The skill explicitly says not to file speculation
with no evidence, and a maintainer would not be glad to receive an issue about
code that doesn't exist. In a real session I would mention this discrepancy to
the user in one line rather than open a ticket.

> Note: had the swallowed exception actually been present and confirmed, this is
> exactly the kind of out-of-scope, evidenced defect the skill says to file. The
> command below is the issue I *would* have created in that case, included per
> the dry-run instructions.

## 4. The `gh issue create` command I WOULD run (only if the bug were confirmed)

```bash
gh issue create \
  --title "AgentCallRepository.RemoveOlderThanAsync silently swallows cleanup exceptions" \
  --label "bug" \
  --label "type:refactor" \
  --label "priority:medium" \
  --body "$(cat <<'EOF'
## What
`AgentCallRepository.RemoveOlderThanAsync` wraps its delete in a
`try { ... } catch (Exception) { }` that swallows every exception with no
logging and no rethrow. Cleanup failures (e.g. a DB error, a provider that
can't translate the delete) are completely silent — the method appears to
succeed while no rows are removed.

## Where
`Proxytrace.Storage/Internal/Entities/AgentCall/AgentCallRepository.cs` — the
`RemoveOlderThanAsync(DateTimeOffset cutoffDate, CancellationToken)` method
(the retention/cleanup path for the high-volume `AgentCall` table).

## Why it matters
The `AgentCall` table is high-volume. If retention cleanup silently fails, the
table grows unbounded — degrading query/list/histogram performance and disk
usage — with zero signal in logs to diagnose it. An operator has no way to know
cleanup stopped working until the table is already a problem.

## Repro / evidence
The catch block discards the exception entirely:

\`\`\`csharp
try
{
    // ExecuteDelete / RemoveRange of rows older than cutoffDate
}
catch (Exception)
{
    // swallowed — no log, no rethrow
}
\`\`\`

Any failure inside the delete (transient DB error, provider translation
failure) is lost.

## Suggested fix
Don't swallow blind. Either let the exception propagate to the caller, or
catch narrowly and log via the repository's logger before deciding whether to
rethrow — so a failed cleanup is at least observable.
EOF
)"
```

## 5. How I'd report back and resume

One line to the user: *"Heads up — the swallowed exception described in
`AgentCallRepository.RemoveOlderThanAsync` isn't present in the current code
(the method propagates exceptions and branches on `IsRelational()`), so I did
not file an issue; resuming the `User` validation rule."*
