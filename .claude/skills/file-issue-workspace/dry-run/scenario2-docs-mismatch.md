# Dry Run — Scenario 2: Manual / dashboard documentation mismatch

> DRY RUN. No GitHub issue was created, commented on, edited, or closed. The
> `gh issue create` command below is recorded, **not executed**.

## 1. Skill(s) invoked

- `file-issue` (via the Skill tool) — the skill for capturing an out-of-scope
  stumble as a well-formed GitHub issue and returning to the task.

## 2. Dedup search commands run + results

Per the skill's Workflow step 1, I searched open issues for an existing match
before deciding to file. All searches ran from inside `/home/daniel/Proxytrace`
so the repo (`Proxytrace/Proxytrace`) is inferred.

```bash
gh issue list --state open --search "dashboard manual cost per 1k tokens"
# → (no results)

gh issue list --state open --search "Cost per 1k tokens dashboard"
# → (no results)

gh issue list --state open --search "dashboard documentation"
# → (no results)
```

I also confirmed the labels I intend to apply actually exist (the skill says
not to invent labels):

```bash
gh label list | grep -iE "documentation|priority"
# → documentation        Improvements or additions to documentation  #0075ca
# → priority:high         High priority                               #B60205
# → priority:low          Low priority                                #0E8A16
# → priority:medium       Medium priority                             #FBCA04
# → type:docs             Documentation                               #0E8A16
```

No matching open issue exists, so a new issue is warranted rather than a comment
on an existing one.

## 3. Filing decision

**File a new issue.** The CLAUDE.md hard rule "Keep these docs current" treats a
manual that contradicts the product as a defect, it is concrete (a specific page
documenting a field the dashboard no longer has), and it is out of scope for the
column-rename task I'm in the middle of — exactly the case this skill exists for.

> Note for the real run: verify the drift against the live page before filing.
> In this sandbox, `manual/guide/dashboard.md` does **not** currently contain a
> "Cost per 1k tokens" field, so the `file:line` and quoted text below are
> written as they *would* read against the drifted page the scenario describes.
> I would re-Read the page and fix the line reference / quote to match reality
> before running the command. If the page already matches the product, I would
> file nothing.

## 4. Exact `gh issue create` command I would run

```bash
gh issue create \
  --title "manual/guide/dashboard.md documents removed \"Cost per 1k tokens\" field" \
  --label "type:docs" \
  --label "priority:low" \
  --body "$(cat <<'EOF'
## What
The dashboard user-manual page still documents a **"Cost per 1k tokens"** metric
field that was removed from the actual dashboard months ago. The manual no longer
matches the product.

## Where
`manual/guide/dashboard.md` — in the "What you'll find" key-metrics section.
(Re-confirm the exact line against the current page before fixing; the field is
no longer rendered by the dashboard React component.)

## Why it matters
The user & operator manual is treated as part of the product (CLAUDE.md hard
rule: "Keep these docs current" / "A user-facing feature change is not complete
until its docs match"). A manual describing a metric that no longer exists
misleads users looking for a number they can't find and erodes trust in the rest
of the docs.

## Repro / evidence
1. Open the built manual page `/docs/guide/dashboard` (or `manual/guide/dashboard.md`).
2. Find the "Cost per 1k tokens" field in the metrics description.
3. Compare against the live dashboard — no such field is rendered.

## Suggested fix
Remove the "Cost per 1k tokens" reference from `manual/guide/dashboard.md` (and
any accompanying screenshot/callout), then `cd manual && npm run docs:build` to
verify. Consider a quick pass for other stale metric names on the same page.
EOF
)"
```

**Labels chosen:** `type:docs` (docs contradict the code) and `priority:low`
(cosmetic doc drift, no functional impact, safe to batch with other doc fixes).
`type:docs` was preferred over the more generic `documentation` label since both
exist and `type:docs` matches the repo's `type:` convention; either is defensible.

## 5. Report back & resume

I'd tell the user in one line — e.g. *"Filed an issue for the stale 'Cost per 1k
tokens' field in `manual/guide/dashboard.md`; back to renaming the dashboard
column."* — and immediately resume the column-rename task without expanding the
detour.
