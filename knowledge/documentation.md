# Documentation as Code

Documentation rots because it lives outside the definition of "done": code merges, docs lag, and
within months the docs are actively misleading — worse than no docs, because readers trust them.
This guide describes a discipline where docs are treated like tests: kept in the repo, updated in
the same change as the code they describe, built and verified mechanically, and aimed at explicit
audiences.

## Principles

- **A change is not complete until its docs match the code.** This is the load-bearing rule.
  Docs are part of the diff, reviewed with the diff, and a doc that contradicts the code is a
  defect to be filed and fixed like any other bug.
- **Docs have audiences; separate them.** Contributor docs (architecture, conventions, how to
  test) and the shipped user/operator manual serve different readers with different vocabularies.
  Mixing them produces docs useless to both.
- **Docs must be findable at the moment of need.** An index that maps *doc → the situation in
  which you must read it* beats a flat folder listing. Nobody reads documentation front to back;
  they arrive with a task.
- **Docs should be buildable and verifiable.** A manual that compiles (static-site build, link
  check) can gate CI; a wiki cannot. Prefer markdown in the repo over any external system.
- **Show, don't only tell.** Screenshots and examples carry more information per reader-second
  than prose — but only if regenerating them is cheap enough that they stay current.
- **The changelog is documentation.** It is the user-facing narrative of the product's evolution
  and often the first doc a user reads after upgrading. Write it for users, in the same change
  as the feature (see the release-engineering guide).

## Practices

### 1. Docs treated like tests

**Problem:** Docs updated "later" are updated never; stale docs then mis-train every future
reader, including AI assistants that weight them heavily.

**Solution:** Encode the rule in the repo's top-level instruction file as a hard rule: when a
change touches anything a doc describes — architecture, entity patterns, commands, workflows —
the matching doc page is updated **in the same change**, and new topics add a row to the doc
index. Reviewers reject PRs whose docs don't match, exactly as they'd reject a PR with failing
tests. Symmetrically: when you *find* a doc contradicting the code while working on something
else, file an issue for it rather than ignoring it.

**Rationale:** The only update moment that reliably happens is "while the change is fresh and the
PR is open." Any deferred-docs process converges on rot. Framing stale docs as defects gives them
a lifecycle (found → filed → fixed) instead of a shrug.

### 2. An index table mapping doc → when to read it

**Problem:** A `docs/` folder with twenty files is write-only storage; contributors don't know
which page applies to their task, so they read none and guess.

**Solution:** The root instruction/readme file carries a two-column table: doc link → "read
before…" trigger, phrased as the *task* ("Read before… touching storage, providers, or
migrations", "…adding any user-facing UI string", "…gating a feature behind a license tier").
Keep the root file itself short; all depth lives in the per-topic pages. Adding a page without
adding its index row is an incomplete change.

**Rationale:** The index turns documentation from pull ("go find out if there's a doc") into
push ("your task matches this trigger — read this first"). It's also the primary routing
mechanism for AI assistants, which read the root file on every session.

### 3. Separate contributor docs from the shipped manual

**Problem:** One docs pile serving both engineers and end users satisfies neither: users hit
migration commands, engineers hit marketing prose, and nobody knows where a new page belongs.

**Solution:** Two trees with a bright line:

- `docs/` — contributor/AI docs: architecture, conventions, testing, database, release process.
  Never shipped.
- `manual/` — the product manual, itself split by audience: a user guide (people using the
  product) and an admin/operator guide (people running it). Shipped with the product.

The completeness rule applies to both: a user-facing feature change is not done until its manual
page matches; new top-level features get a new page wired into the manual's navigation config.

**Rationale:** Explicit audiences make every page's vocabulary, depth, and placement obvious, and
make "which docs does this PR owe?" a mechanical question.

### 4. The manual is a static site served by the product itself

**Problem:** Hosted docs sites drift out of sync with self-hosted or versioned installations —
the user on v1.4 reads docs describing v2.1's UI.

**Solution:** Build the manual from markdown with a static-site generator (VitePress is one
illustration) into searchable HTML, and serve it from the running product (e.g. at `/docs`).
The manual versions with the code automatically because it ships *in* the artifact. Give it a
local preview command (`npm run docs:dev`) and use the production build (`npm run docs:build`)
as a CI verification step — broken links and malformed pages fail the build.

**Rationale:** Serving the manual from the product guarantees version alignment for free, works
in air-gapped deployments, and the build step turns "the docs are broken" from a user report into
a CI failure.

### 5. Screenshots via automated capture against a seeded demo stack

**Problem:** Manual screenshots are so expensive to produce (boot the app, create realistic data,
crop, embed) that pages ship text-only, and existing screenshots fossilize as the UI evolves.

**Solution:** Maintain a dedicated demo/kiosk configuration of the product — self-seeding with
realistic data, login-free — bootable with one compose file. A capture script (Playwright or
similar) drives it, takes consistently-styled screenshots into a predictable directory layout
(`manual/public/screenshots/<page>/`), embeds them, and tears the stack down. Package the whole
workflow as an executable playbook/skill so refreshing every screenshot after a UI change is one
invocation. Then set the editorial default to *include* screenshots on user-guide pages rather
than treating them as a luxury. Note the limits honestly: a login-free kiosk can't reach admin
pages, so operator docs may stay text-only.

**Rationale:** Once capture is automated, the cost asymmetry flips — stale screenshots become a
regeneration command instead of an afternoon, so the manual can afford to be visual. The seeded
stack also guarantees screenshots show realistic, consistent, non-confidential data.

### 6. The changelog as a user-facing document

**Problem:** Changelogs written as commit summaries ("fix null ref in FooService") tell users
nothing; users then can't tell whether an upgrade matters to them.

**Solution:** Write changelog entries as short user-facing narratives — what changed, in the
user's vocabulary, with the *why it matters* included ("Blocked calls still show up as traces,
flagged…"). Bold a one-line lede per entry so the section skims well. Since the changelog becomes
the release notes verbatim (see release-engineering), this is the text users actually read.

**Rationale:** The changelog is often the highest-traffic doc you publish. Treating it as an
internal ledger wastes that attention.

## Pitfalls

- **The index rots while pages get added.** New doc pages without index rows are invisible.
  Make "add the row" part of the definition of done for a new page.
- **The root file accretes until nobody reads it.** Depth belongs in topic pages; the root file
  is an index plus hard rules. If it doesn't fit on a couple of screens, push content down.
- **Docs describing intent rather than reality.** A doc written before the code and never
  revisited is a design doc, not documentation. Date or delete aspirational content.
- **Screenshot debt.** Automated capture only helps if it's actually rerun. Tie screenshot
  refresh to UI-changing PRs the same way manual-page updates are tied to feature PRs.
- **One giant "documentation update" PR.** Batching doc fixes decouples them from the changes
  that made them necessary — the same failure mode as batching tests. Docs ride the feature PR.
- **Duplicating content across audiences.** If the same instructions live in `docs/` and
  `manual/`, they will diverge. Pick the owning audience and cross-link.
- **Skipping the build check.** An unbuilt manual accumulates broken links and dead images
  silently. `docs:build` in CI is cheap insurance.

## Checklist for a new project

- [ ] `docs/` folder for contributor docs; root instruction file with an index table
      (doc → "read before…").
- [ ] Hard rule written down: docs updated in the same change as the code they describe; stale
      docs are defects.
- [ ] `manual/` static-site project split into user guide and operator guide, built in CI and
      served by the product at a stable path.
- [ ] Manual navigation config treated as part of "wiring a new feature" — new top-level features
      get a page.
- [ ] Seeded, login-free demo stack + scripted screenshot capture, packaged as a one-command
      playbook; user-guide pages default to including screenshots.
- [ ] `CHANGELOG.md` written for users, entry added in the same PR as each user-facing change.
- [ ] Review checklist item (human and AI): "do the docs owed by this change exist and match?"
