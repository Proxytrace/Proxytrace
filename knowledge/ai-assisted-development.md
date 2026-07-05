# Structuring a Repository for AI-Assisted Development

AI coding assistants fail in a characteristic way: they produce *locally plausible* changes that
violate *global* invariants — a hardcoded UI string in a multilingual app, a query that's fine on
ten rows and catastrophic on ten million, a workaround for a bug that should have been recorded.
The fix is not better prompting per session; it is structuring the repository so that the
knowledge an assistant (or a new human) needs is discoverable, enforceable, and executable.
Almost everything below improves human onboarding for the same reasons.

## Principles

- **The repo is the prompt.** Assistants read the root instruction file and whatever docs it
  routes them to. Context that lives in someone's head, a chat thread, or a wiki does not exist.
- **Short root, deep leaves.** A root instruction file (CLAUDE.md / AGENTS.md) that tries to
  contain everything gets skimmed and ignored. Keep it to hard rules plus an index; put depth in
  per-topic pages loaded on demand.
- **Just-in-time context beats up-front context.** "Read the relevant page before working in that
  area" scales to any codebase size; "here is everything" does not fit in any context window —
  human or machine.
- **Recurring workflows should be executable, not described.** A written procedure gets
  paraphrased and drifted; a skill/playbook that is invoked gets followed.
- **Invariants belong in machines where possible, prose where necessary.** A lint rule is obeyed
  100% of the time; a sentence in a doc is obeyed when it happens to be in context. Prose rules
  are for what machines can't check — and should migrate toward enforcement over time.
- **Explain the why.** Rules with rationale ("a correctness test on a few in-memory rows does not
  catch client-side evaluation") survive judgment calls and edge cases; bare imperatives get
  rules-lawyered by humans and AIs alike.
- **Assistants observe a lot; capture it.** An agent traversing the codebase notices bugs, debt,
  and contradictions constantly. Without a capture mechanism, those observations evaporate.

## Practices

### 1. A short root instruction file: hard rules + an index

**Problem:** Root instruction files bloat into unreadable walls; assistants (and humans) skim
them, miss the one rule that mattered, and improvise.

**Solution:** The root file contains exactly two things. First, an **index table** mapping each
per-topic doc to its trigger: "read before touching storage/migrations", "read before adding any
user-facing string", "read before touching the release workflow". Second, a small set of **hard
rules** that apply everywhere regardless of area (see Practice 4). Everything else — style
guides, entity patterns, subsystem walkthroughs — lives in the per-topic pages the index points
to. State explicitly that the index is mandatory routing: *do not rely on this file alone*.

**Rationale:** The index converts a passive doc pile into an active dispatch mechanism: the
assistant matches its current task against the trigger column and loads only the relevant page,
keeping context focused and current. The same table is the best onboarding page a human gets.

### 2. "Read the relevant page before working in that area"

**Problem:** Assistants pattern-match from generic training knowledge ("this is how React apps
usually do it") instead of the project's actual conventions, producing changes that look right
and are wrong.

**Solution:** Make pre-reading a stated obligation, and make the pages worth reading: each
per-topic doc is the *source of truth* for its area (the five-file entity pattern, the test
harness rules, the design system) and explicitly **overrides** conflicting recommendations from
generic tools or habits. Where two docs share an area, make the split sharp (e.g. "DESIGN.md =
what it looks like; BEST_PRACTICES.md = how it's built"). Mark known-bad existing code so it
isn't copied as precedent: "large debt files violate the guide and are **debt, not precedent**."

**Rationale:** An assistant's strongest instinct is to imitate neighboring code and general
convention. Authoritative, override-declaring docs — plus explicit debt labeling — redirect that
instinct toward the project's real rules instead of its worst existing file.

### 3. Executable skills/playbooks for recurring workflows

**Problem:** Multi-step workflows (cut a release, write an e2e test, refresh screenshots, file an
issue) are re-derived from scratch each session — slowly, and differently each time.

**Solution:** Package each recurring workflow as a skill: a markdown playbook with a
trigger-rich description (so it activates on natural phrasings — "ship what's on master", "add a
browser test", not just its formal name), preconditions ("requires a Docker daemon — check first,
skip and say so if absent"), exact commands, decision points with criteria, and failure-recovery
paths. Typical catalog: file an issue, write a unit/e2e test, run and triage the test suites, cut
and verify a release, capture manual screenshots, scaffold a new domain entity. Claude Code
skills are one implementation; a `runbooks/` folder with the same structure serves any tooling.

**Rationale:** A skill is a procedure that executes the same way every time — the difference
between "the release process" as tribal memory and as an artifact. Encoding failure recovery is
the highest-value part: ad-hoc recovery under pressure is where both humans and AIs do the most
damage.

### 4. Hard rules that encode invariants

**Problem:** Cross-cutting invariants are exactly what a locally-focused change misses: the diff
compiles, tests pass, and the system-level property is silently broken.

**Solution:** Maintain a short list of always-on rules in the root file, each encoding an
invariant with its failure mode. Archetypes:

- **No escape-hatch suppressions** (e.g. nullable-suppression operators are "strictly forbidden
  everywhere") — because each suppression is a deferred crash that type-checking was designed to
  prevent.
- **Perf evidence for high-volume paths** — any change to a query/index/mapping on an unboundedly
  growing table must add or extend a perf test against a budget, because "a correctness test on a
  few in-memory rows does not catch client-side evaluation, bad query plans, or O(rows) blow-ups
  that only bite at scale."
- **Every user-facing string goes through the i18n layer** — a hardcoded string ships silently
  and only fails for the non-English half of your users.
- **Docs and changelog updated in the same change** — see the documentation and
  release-engineering guides.

Keep the list under ~10 items; each must state *why*, so it generalizes to cases the wording
didn't anticipate.

**Rationale:** These are precisely the properties an AI cannot infer from the files it happens to
open. Naming them globally — with rationale — is the cheapest defense against
plausible-but-wrong.

### 5. File issues for stumbles, never silently work around

**Problem:** While doing task X, an assistant notices bug Y. It either derails into fixing Y
(scope creep, bloated diff) or shrugs past it (the knowledge dies with the session). Silent
workarounds are the worst case: the code now *depends* on the bug.

**Solution:** Provide a third path as an explicit rule plus a skill: capture the stumble as a
well-formed tracker issue (~30 seconds), then return to the task. The skill encodes the quality
bar: search for duplicates first; evidence required (no speculative "might be slow" filings);
searchable symptom-first title; and a calibration for borderline opinions — "the bar is *would a
maintainer be glad this was written down*, not *everything I'd change*." Pair it with a
consuming-side skill (pick the top issue, branch, fix, PR) so the queue actually drains.

**Rationale:** Agents read enormous amounts of code incidentally and are excellent defect
detectors — but only if observations are captured with context while fresh. This rule converts a
byproduct of every session into a maintained backlog, and removes the perverse incentive to
"just make it work" around a latent bug.

### 6. Team-of-experts task decomposition

**Problem:** One agent context doing everything on a large task loses the plot: the context
fills with file dumps, and implementation concerns crowd out review and documentation concerns
entirely.

**Solution:** Instruct that nontrivial tasks be staffed as a team of role-scoped subagents —
architect (plan), engineer (implement), tester (verify and give concise feedback), documenter
(docs + manual), reviewer (angle chosen by the change: security, UX, performance) — spawned *only
when the task warrants them*. Each role returns conclusions, not transcripts, to the coordinating
context.

**Rationale:** Roles are checklists in disguise: a designated documenter makes "did we update the
manual?" structurally unskippable, and a reviewer with fresh context catches what the author's
context is blind to. Independent roles also parallelize, and the coordinator's context stays
small enough to hold the actual plan. The "only when necessary" clause matters — mandatory
ceremony on trivial tasks teaches everyone to ignore the process.

### 7. Keep instructions enforceable: lint rules over prose

**Problem:** Prose rules decay — they're followed when in context and forgotten otherwise; every
violation that lands makes the next one look like precedent.

**Solution:** For every recurring rule, ask "can a machine check this?" and prefer the strongest
available rung: **compiler/type-system** (strict null checking) → **lint rule** (raw HTML
controls blocked via `no-restricted-syntax`, forcing the design-system primitives; escape
hatches require an inline justification comment) → **CI gate** (docs build, changelog-section
check in the release workflow, perf budgets as machine-readable files like `perf-budgets.json`)
→ **prose** (only for what machines can't judge, e.g. "write changelog entries for users").
When a prose rule is violated twice, treat that as a signal to promote it up the ladder.

**Rationale:** Enforced rules cost zero ongoing attention and can't be forgotten by an assistant
whose context didn't include them. Prose spent on machine-checkable things is prose that dilutes
the rules only prose can carry.

## Pitfalls

- **The root file as attic.** Every incident adds a paragraph until nothing stands out. Budget
  it (a couple of screens); push detail into indexed topic pages.
- **Skills with narrow trigger descriptions.** A skill that only activates on its exact name
  never fires; write descriptions covering the natural phrasings of the need.
- **Rules without rationale.** "Never do X" gets overridden the first time X looks locally
  reasonable. "Never do X because Y" survives.
- **Stale instructions poisoning the well.** Assistants trust the instruction file *more* than
  code. An outdated rule there does more damage than no rule — the docs-as-code discipline
  applies to the instruction files themselves.
- **Issue-filing without calibration.** Unchecked, stumble-filing floods the tracker with
  speculative or opinion issues; the dedup step, evidence bar, and "glad it was written down"
  test are load-bearing.
- **Ceremony over judgment.** Forcing the full expert-team decomposition, or every skill, on
  one-line fixes teaches contributors (and agents) to route around the process.
- **Escape hatches without friction.** If suppressing a lint rule is a bare one-liner, it
  becomes the default; require an inline reason so every suppression is a visible, reviewable
  decision.

## Checklist for a new project

- [ ] Root instruction file (CLAUDE.md / AGENTS.md): index table (doc → "read before…") plus
      under ~10 hard rules, each with its rationale.
- [ ] Per-topic docs declared as area sources of truth that override generic conventions; known
      debt files explicitly labeled "debt, not precedent".
- [ ] Skills/playbooks for the recurring workflows: file-issue, write-test, run-and-triage-tests,
      release, screenshots, scaffold-entity — each with triggers, preconditions, commands, and
      failure recovery.
- [ ] Hard rules covering the project's cross-cutting invariants (suppression bans, perf
      evidence at scale, i18n coverage, docs/changelog in the same change).
- [ ] File-issues-for-stumbles rule + skill (dedup, evidence bar, title quality), plus an
      issue-consuming counterpart.
- [ ] Team-of-experts guidance for nontrivial tasks, with roles spawned only as needed.
- [ ] Every recurring rule audited up the enforcement ladder: type system → lint → CI gate →
      prose; escape hatches require inline justification.
- [ ] Instruction files themselves covered by the "docs updated in the same change" rule.
