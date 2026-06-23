---
name: implement-issue
description: >-
  Autonomously pick the highest-priority open GitHub issue from the current
  repo, implement a real fix on a fresh branch, and open a pull request that
  closes it. Use this whenever the user wants you to work an issue end-to-end
  without naming a specific bug to fix yourself — e.g. "grab the next issue",
  "work on the top issue", "pick up a ticket and do it", "knock out a backlog
  item", "implement the highest-priority bug and open a PR", "what should I work
  on next? just do it", "clear an issue off the board". Also use it when the
  user names a specific issue to implement ("implement #142", "do issue 87,
  branch and PR it") — skip the ranking and go straight to that issue. This is
  the issue-CONSUMING skill; it is the opposite of filing a new issue, so do
  NOT use it for "file/open/log an issue" requests (that is the file-issue
  skill). Prefer this skill over an ad-hoc fix-it-yourself approach the moment
  the work is sourced from the GitHub issue tracker, because it enforces the
  branch -> commit -> PR hygiene and the repo's own contribution conventions.
---

# Implement a GitHub issue end-to-end

You pick the most important open issue, fix it properly on its own branch, and ship a PR that
closes it. The user has authorized the full branch → commit → push → PR flow by invoking this
skill, so you do not stop for confirmation — but "autonomous" means *thorough and self-checking*,
not *fast and sloppy*. A PR that fails CI or misreads the issue wastes more of the user's time than
a careful one. Slow down where correctness lives (understanding the issue, verifying the fix),
move fast on the mechanics (branching, committing).

Work the phases in order. Each phase explains *why* it exists so you can adapt when reality differs
from the happy path.

## Phase 0 — Preflight

Confirm the ground is solid before you touch anything. A surprise here (dirty tree, wrong repo,
no auth) is far cheaper to catch now than after you've written code.

- `gh auth status` and `git status --porcelain`. If the working tree is dirty, **stop and tell the
  user** — you must not bury their uncommitted work inside an issue branch. This is the one place you
  pause, because the alternative is silent data loss.
- Identify the repo (`gh repo view --json nameWithOwner,defaultBranchRef`) and its default branch.
- **Read the repo's contribution conventions now**, before writing code — they override your
  defaults. Look for `CLAUDE.md` / `AGENTS.md` / `CONTRIBUTING.md` at the root and any `docs/` index
  they point to. These tell you the build/test commands, the doc/changelog rules, the commit/PR
  trailers, and which other skills are mandatory (e.g. a `test` skill for backend tests, a
  `file-issue` skill for stumbles). Honoring them is what makes the PR mergeable instead of a
  conventions-violating draft someone has to rewrite.

## Phase 1 — Select the issue

If the user named a specific issue, use it; skip ranking. Otherwise rank the open issues:

```bash
REPO=<owner/name> scripts/pick_issue.sh | jq '.[0:5]'
```

`pick_issue.sh` returns open issues ordered **highest priority first**, breaking ties by oldest
(priority label tier `priority:high|P0|critical` > `priority:medium|P1` > `priority:low|P2` >
unlabeled; see the script header for the full mapping). It already drops `wontfix`/`duplicate`/
`invalid` — issues a PR could never legitimately close. Element `[0]` is your pick; the next few are
the runners-up you mention in your final report so the user sees what you bypassed.

Before committing to the pick, sanity-check it — this guards against the script handing you work
that is already taken or not actually actionable:

- `gh issue view <n> --comments` — read the **whole** issue and its discussion. The fix lives in the
  details and the comments often contain the real decision, a repro, or a "actually don't do this".
- If the issue already has a **linked open PR** (`gh issue view <n> --json …` timeline, or it reads
  as in-progress), skip it and take the next candidate — duplicating someone's in-flight work is the
  worst outcome here.
- If the top issue is genuinely unactionable (pure question, needs a product decision you can't make,
  asks for something destructive or out of scope), skip to the next and note why. Don't force a PR
  for an issue that isn't ready; picking the #2 issue is better than shipping a guess on #1.

Announce the pick in one line before you start: number, title, priority, and why it won.

## Phase 2 — Branch

Branch off a fresh default branch so your work is isolated and the PR diff is clean:

```bash
git switch <default-branch> && git pull --ff-only
git switch -c <type>/issue-<n>-<short-slug>
```

Name the branch from the issue's nature — `fix/issue-217-email-severity-default`,
`feat/issue-142-jwt-rotation`, `refactor/issue-198-dispose-chatclient`. The issue number in the
branch name makes the lineage obvious to anyone scanning branches later.

## Phase 3 — Implement

This is the work. Match the change to the issue — a bug gets a minimal, targeted fix plus a
regression test; a feature gets a complete, conventions-following implementation.

- **Use the right process for the work.** A bug report → debug it systematically and confirm the
  root cause before patching (treating a symptom leaves the issue half-fixed). A feature/refactor →
  if the approach is genuinely ambiguous, design briefly before coding. Invoke whatever process and
  domain skills the repo expects (the `test` skill for tests, framework/design skills for UI, etc.) —
  the conventions you read in Phase 0 tell you which are mandatory, and they are not optional just
  because you're moving autonomously.
- **Write the code as the surrounding code is written.** Match naming, structure, error handling, and
  comment density of the files you touch. The goal is a diff a maintainer reads as "obviously one of
  ours", not "an outside bot's".
- **Scope discipline.** Fix the issue, not everything adjacent to it. If you trip over a *separate*
  problem, capture it the way the repo wants (a `file-issue` skill, a TODO, or a note in the PR) and
  keep going — scope creep turns a reviewable PR into an unreviewable one. If the issue itself is too
  large for one PR, implement the coherent first slice and say so in the PR body.
- **Prove the fix.** Add or extend a test that fails before your change and passes after — for a bug,
  that test *is* the evidence the issue is actually resolved.

## Phase 4 — Verify (the pre-PR gate)

Do not open a PR on unverified code — a red PR costs the user a round-trip and erodes trust in the
skill. Run the repo's real gate, in this order, using the commands you found in Phase 0:

1. **Build** — it must compile.
2. **Tests** — run the affected suite (and the broad suite if the change is cross-cutting). Green,
   not "probably fine".
3. **Docs / changelog / manual / i18n** — apply the repo's documentation rules. Many repos (this one
   included) treat docs and the changelog as part of the change and will reject a PR without them;
   "a change is not complete until its docs match the code". Add the changelog entry, update the
   affected `docs/`/manual pages, run any string-extraction step the repo mandates.

If verification fails, **fix it before proceeding** — looping back into Phase 3 is normal and
expected. The gate is the whole point of doing this autonomously; never paper over a failure to reach
the PR faster.

## Phase 5 — Commit

One focused commit (or a small, logical sequence). Write a real message, not "fix issue":

- Follow the repo's commit convention (e.g. Conventional Commits: `fix(auth): …`).
- Reference the issue in the body (`Refs #<n>`; the `Closes` keyword goes on the PR so the issue
  closes on merge).
- **Apply the repo's commit trailer if it mandates one** (Phase 0). This repo requires:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

```bash
git add -A
git commit   # multi-line message via -m/-m or a heredoc
```

## Phase 6 — Open the PR

Push and open the PR against the default branch:

```bash
git push -u origin HEAD
gh pr create --base <default-branch> --fill=false --title "<type>: <summary> (#<n>)" --body "<body>"
```

PR body — keep it skimmable and evidence-backed:

```
## Summary
<2–4 sentences: what the issue was and how this fixes it.>

Closes #<n>

## Changes
- <bullet per meaningful change>

## Verification
- build: <result>
- tests: <which suites ran, result>
- docs/changelog: <what you updated, or why N/A>

<repo-mandated PR trailer — this repo: 🤖 Generated with [Claude Code](https://claude.com/claude-code)>
```

`Closes #<n>` is load-bearing: it auto-closes the issue when the PR merges, which is the whole
point of the workflow. Double-check the number.

## Phase 7 — Report

Tell the user, in a few lines: which issue you picked and **why it outranked the runners-up**, what
you changed, the verification results, and the **PR URL**. If you skipped the top-ranked issue, say
which and why. If you made a judgment call (interpreted an ambiguous spec, deferred a slice, filed a
follow-up issue), surface it here so nothing is buried.

## When things don't fit the happy path

- **No open issues / none actionable** → report that plainly; don't invent work or open a PR for a
  non-issue.
- **Dirty working tree** → stop at Phase 0 and ask (above).
- **Issue needs a decision you can't make** (product call, breaking-change tradeoff) → skip to the
  next candidate, or if the user clearly wanted *that* issue, do the analysis and ask one sharp
  question rather than guessing.
- **No `gh`/auth, or no push rights** → surface the exact error; the user fixes access, you don't
  work around it.
