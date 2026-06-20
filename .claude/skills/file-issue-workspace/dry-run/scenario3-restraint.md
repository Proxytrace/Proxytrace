# Scenario 3 — Restraint (dry run)

## 1. Skill(s) invoked

- `file-issue` (via the Skill tool).

No GitHub issue was created, edited, commented on, or closed (dry-run constraint
honored). No duplicate search was even run, because the observation never
cleared the bar for filing in the first place — see below.

## 2. Decision: **DROP** (do not file) — optionally mention to the user in one line

### What drove it

The `file-issue` skill is explicit about this exact situation. Two passages
apply:

- **"Don't file when … It's pure speculation with no evidence."** My observation
  is "the settings page could be designed better" with no concrete defect I can
  point at. The skill says to "investigate enough to make it concrete, or drop
  it." I have nothing concrete to investigate — the page works, nothing is
  broken, the layout is just personally a bit bland to me.
- **"If it's genuinely borderline or subjective ('I'd have designed this
  differently'), don't auto-file a stream of opinions — mention it to the user
  in one line and let them decide."** That is a near-verbatim description of this
  observation.

The skill's stated bar is: *"would a maintainer be glad this was written down,"
not "everything I'd change."* A subjective "feels bland, no defect" note would
be noise in the issue tracker, not signal. So filing is the wrong move.

The whole point of this scenario is **restraint**: the eagerness to capture
stumbles is for *real, evidenced, out-of-scope problems* — latent bugs, swallowed
exceptions, stale docs, N+1 queries. It is not a license to dump aesthetic
opinions into the tracker. Filing here would be exactly the "stream of opinions"
the skill warns against.

## 3. Since I would NOT file — what I'd say to the user

A single, low-key line, offered and then dropped (I do not derail the typo fix
to pursue it):

> "Side note while I was in the settings page for the typo: the layout works
> fine, I just personally found it a bit bland — no concrete defect, so I'm not
> filing anything. If you'd like, I can sketch some design improvements
> separately. Otherwise I'll leave it. Back to the typo fix."

If the user expresses no interest, the observation is dropped entirely — it does
not become an issue, and it does not expand the current change.

## Return to task

Notionally returning to the one-character typo fix on the settings-page button
label. No scope creep; the diff stays a single-character change.
