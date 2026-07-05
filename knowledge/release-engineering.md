# Release Engineering

Releases fail in predictable ways: nobody remembers what changed, the version number lives in
three files that drift apart, the "release process" is a senior engineer's muscle memory, and the
first time anyone tests the install artifact is when a customer does. This guide describes a
release discipline where cutting a version is a boring, automated, verifiable event — and where
the default branch is releasable at any moment.

## Principles

- **One source of truth for the version.** The version should be defined in exactly one place —
  ideally the git tag itself — and propagate mechanically into every binary, image, API response,
  and UI string. Two version fields will eventually disagree.
- **The changelog is written when the change is made, not when the release is cut.** Reconstructing
  release notes from `git log` at release time produces commit-speak, misses user impact, and
  makes releasing expensive enough that people avoid it.
- **A release is a pipeline, not a ritual.** Everything after "push the tag" should be automation:
  validation, gating tests, artifact builds, publishing. Human judgment belongs before the tag
  (what to ship) and at the final go-live (when customers see it), not in between.
- **Ship an artifact, not instructions.** Customers/operators should receive a self-contained,
  version-pinned deployable — not a wiki page of steps that rot.
- **Trust, then verify.** A green pipeline is a claim; pulling the published artifact and running
  it is evidence. Verify every release post-publish.
- **The commands to build, run, and test are documented in one canonical place.** If a newcomer
  (human or AI) has to guess or ask, the knowledge is tribal and will be guessed wrong.

## Practices

### 1. Keep a Changelog, filled in the same change as the feature

**Problem:** Release notes assembled at release time are incomplete, developer-centric, and slow
to produce; the person cutting the release didn't write half the features.

**Solution:** Maintain `CHANGELOG.md` in [Keep a Changelog](https://keepachangelog.com) format
with a permanent `[Unreleased]` section. Make it a hard repository rule (enforced in review and
in the contributor/AI instruction file): *every user-facing change adds its entry to
`[Unreleased]` in the same PR*. Entries are written for users — what changed and why they care —
under the standard categories (Added/Changed/Fixed/Removed/Security).

**Rationale:** The author, at the moment of the change, is the only person who can cheaply write
an accurate user-facing description. Batching that work to release time converts a 2-minute task
into an afternoon of archaeology — which is exactly why release notes are usually bad.

### 2. Changelog becomes the release notes verbatim

**Problem:** Duplicated effort and drift between the changelog, GitHub release notes, and
announcement text.

**Solution:** The release pipeline extracts the tagged version's changelog section with a script
and publishes it verbatim as the release notes. Crucially, the *same script* runs as an early
pipeline guard: if `CHANGELOG.md` has no section matching the tag, the release fails fast —
before any expensive build steps.

**Rationale:** One rendering pipeline means one place to get it right, and the fail-fast guard
turns "we forgot the changelog" from an embarrassing published release into a 30-second fix.

### 3. Tag-triggered release workflow; the tag is the version

**Problem:** Version fields in `package.json`, project files, and config files drift; "bump the
version" commits clutter history; the release process depends on someone's laptop.

**Solution:** The annotated git tag `vX.Y.Z` (SemVer) is the *only* place the version exists.
In-repo builds default to a sentinel like `0.0.0-dev`; the release workflow (triggered by the tag
push, serialized via a concurrency group) injects the tag's version into every build as a
parameter/build-arg, from which assembly metadata, image tags, and UI strings all derive. All
code reads the version through one seam (a single interface/constant), never from ad-hoc
sources that lose information (e.g. reflection APIs that drop prerelease suffixes).

The workflow, in order: (1) validate tag format + changelog section; (2) re-run the CI and e2e
suites as release gates (reuse the existing workflows via `workflow_call` rather than
duplicating them); (3) build and publish versioned images/packages; (4) assemble the deploy
artifact and create the release.

**Rationale:** Nothing in-repo can drift from a tag, dev builds are unmistakably dev builds (the
sentinel can also disable update checks and telemetry), and the entire release is reproducible by
anyone with tag-push rights — no tribal knowledge, no snowflake laptop.

### 4. Draft-first publishing: decouple "built" from "live"

**Problem:** The moment of customer exposure is welded to the tag push, so a mistake discovered
during the pipeline is already public.

**Solution:** The workflow creates the release **as a draft**. A human clicks "Publish" (or runs
one CLI command) as the deliberate go-live. Anything consuming the public releases API — update
banners, download pages — stays silent until then. Be explicit in docs about which side-effects
still happen pre-publish (e.g. rolling image tags like `latest` may advance at image-push time)
and why that's acceptable.

**Rationale:** This gives you a free verification window between "everything built" and "customers
see it", and makes the point of no return a conscious human decision instead of an accidental one.

### 5. A versioned, self-contained deploy artifact

**Problem:** Installation instructions ("clone the repo, then...") rot, reference internal paths,
and can't be pinned to a version.

**Solution:** Ship a small artifact (e.g. a zip of `docker-compose.yml` + `.env.example` +
`README`) attached to the release. The pipeline pins exact image versions into it (the in-repo
copy tracks `latest`; the shipped copy is fully pinned). Required secrets are enforced by the
artifact itself (e.g. `${VAR:?}` in compose). Hard invariant: **the artifact must run from a bare
directory containing only its own files** — it may never reference repository paths; anything it
needs gets baked into the images.

**Rationale:** "Runnable from a bare directory" is a testable property that prevents the classic
failure of an install guide that only works inside a dev checkout. Pinning makes installs
reproducible and rollbacks trivial.

### 6. In-app update check against the releases feed

**Problem:** Self-hosted operators don't watch your releases page; they run stale, unpatched
versions forever.

**Solution:** The app polls the public releases feed (daily is plenty) and shows an
administrator-only banner when a newer version exists. Make it configurable (enable flag,
manifest URL, interval), disable it for dev-sentinel builds and demo modes, and expose it via an
admin API endpoint too. Because drafts are hidden from the feed (Practice 4), the banner and the
publish click compose correctly: publishing *is* the announcement.

**Rationale:** The update check closes the loop of the whole system — changelog → release notes →
feed → banner — so a single publish action informs every running installation, with zero extra
communication work.

### 7. Prereleases via rc tags

**Problem:** You need a dry run of the full pipeline, or a staged rollout, without moving
customers.

**Solution:** Prerelease tags (`v1.2.0-rc.1`) run the identical pipeline but publish *only* the
exact version tag (no `latest`/rolling tags) and create a marked prerelease, which update
checks ignore. Nothing customer-facing moves.

**Rationale:** The only trustworthy test of a release pipeline is running the release pipeline.
rc tags make that safe and cheap, so you actually do it before the release that matters.

### 8. Post-release verification

**Problem:** A green workflow proves the pipeline ran, not that the published artifacts work.

**Solution:** After publishing, verify from the *consumer's* position: pull the published images
by their new tags, download the release zip, boot it in an empty directory with the example env,
and hit a health/version endpoint confirming the running system reports the released version.
Script or document this as a checklist with explicit recovery steps for each failure mode (bad
changelog section, failed gate, broken artifact) — recovery under pressure is when documentation
pays for itself.

**Rationale:** The failure modes this catches (missing image platform, artifact referencing a repo
path, version not propagated) are exactly the ones internal CI can't see because CI runs inside
the repo.

### 9. One documented command set

**Problem:** "How do I run the tests?" answered differently by every team member; newcomers and AI
assistants guess plausible-but-wrong commands.

**Solution:** Maintain a single `commands` doc (or a task runner like `just`/`make` whose file *is*
the doc) covering: build, run each component, run tests (all and single-project), migrations, the
all-in-one dev script, release commands, and any suites with preconditions. State the
preconditions explicitly ("requires a Docker daemon — check first, skip and say so if absent")
rather than letting people discover them via cryptic failures. Provide a one-command dev
entrypoint (`./dev.sh`) that starts the whole stack.

**Rationale:** A canonical command set makes onboarding self-service and makes automation (CI,
AI agents) reliable — anything not written down will be reinvented incorrectly.

## Pitfalls

- **An empty `[Unreleased]` at release time.** It means the discipline lapsed. Treat it as a
  process bug: reconstruct from git history once, then re-enforce the same-PR rule.
- **Changelog entries written for developers.** "Refactored FooService" is not a release note.
  Entries describe user-visible behavior; internal-only changes get no entry.
- **Version fields creeping back in.** Someone adds a `version` to a manifest "because the tool
  wants one" — pin it to the dev sentinel and document that the tag overrides it, or it will drift.
- **Release workflow duplicating CI.** Copy-pasted test jobs diverge from the real CI within
  months. Reuse the CI workflows as callable gates.
- **Deploy artifact silently depending on the repo.** One relative path to a config file works in
  dev and breaks every customer install. Test from a bare directory.
- **Treating the tag push as go-live.** Without draft-first, there is no verification window and
  no clean recovery from a bad build.
- **Debug symbols / sourcemaps leaking into shipped artifacts.** For proprietary self-hosted
  software, published images can leak repo URLs and line-level source maps via PDBs/sourcemaps.
  Strip them deliberately and document the trade-off (stack traces lose line numbers; pair them
  with the reported version instead).

## Checklist for a new project

- [ ] `CHANGELOG.md` in Keep a Changelog format with an `[Unreleased]` section, plus a written
      hard rule: user-facing changes update it in the same PR.
- [ ] Version defined solely by the `vX.Y.Z` git tag; builds default to a `0.0.0-dev` sentinel;
      one code seam for reading the version.
- [ ] Tag-push-triggered release workflow: validate tag + changelog → run CI/e2e gates (reused,
      not duplicated) → publish versioned artifacts → create a **draft** release with the
      changelog section as notes.
- [ ] Changelog-extraction script shared between the guard and the notes step.
- [ ] Self-contained, version-pinned deploy artifact attached to the release; verified runnable
      from a bare directory.
- [ ] In-app admin-only update check against the releases feed; off for dev builds.
- [ ] rc-tag prerelease path that publishes no rolling tags and triggers no update banners.
- [ ] Documented post-release verification steps, including failure recovery.
- [ ] A single commands doc or task runner covering build/run/test/migrate/release, with explicit
      preconditions and a one-command dev entrypoint.
