# Dependabot PR triage — dry run (2026-07-12)

Repo: `Proxytrace/Proxytrace` · 12 open Dependabot PRs (#329–#342) · **no PR was merged, closed, commented on, or checked out.**

## Verdict at a glance

| PR | Bump | Scope | Recommendation |
|----|------|-------|----------------|
| #331 | dompurify 3.4.10 → 3.4.11 (`/frontend`) | runtime, security | **Merge** — fixes a real advisory |
| #334 | github/codeql-action v3 → v4 | CI workflow | **Merge** — self-validated by its own run |
| #329 | qs 6.15.1 → 6.15.3 (`/sample-client`) | demo app, lockfile only | **Merge** — zero product blast radius |
| #340 | dotenv 16.6.1 → 17.4.2 (`/e2e`) | e2e config, dev-only | **Merge** — major, but our call site is unaffected |
| #332 | docker/login-action 3 → 4 | release workflow | **Merge as a batch with #333/#335/#337**, then smoke-test the next release |
| #333 | docker/build-push-action 6 → 7 | release workflow | ↑ same batch |
| #335 | docker/setup-qemu-action 3 → 4 | release workflow | ↑ same batch |
| #337 | docker/setup-buildx-action 3 → 4 | release + e2e workflow | ↑ same batch |
| #339 | npm-minor-patch group, 33 updates | frontend + e2e runtime | **Leave open** — needs a real e2e/unit run first (see below) |
| #336 | node 24-alpine → 26-alpine (`/frontend` Dockerfile) | release image build | **Leave open** — Node 26 is not LTS yet; do it with #341/#342 as one Node bump |
| #341 | @types/node 22 → 26 (`/e2e`) | dev types | **Leave open** — part of the same Node bump |
| #342 | @types/node 24 → 26 (`/frontend`) | dev types | **Leave open** — part of the same Node bump |

**Nothing warrants closing.** Every PR is either good now or good later; none is wrong on the merits.

---

## Blocking context you should know before merging anything

Two CI gaps materially change how much the green checkmarks are worth:

1. **The E2E workflow is switched off.** `gh api .../actions/workflows` reports `.github/workflows/e2e.yml` in state **`disabled_manually`**, and the last E2E run of any kind was **2026-05-31**. `e2e.yml` on `master` still declares `on: pull_request`, and `.github/dependabot.yml`'s header comment claims *"Every PR runs the full ci + e2e gates"* — that statement is currently false. **No Dependabot PR in this queue has any e2e coverage.**
2. **CI never runs the frontend unit tests.** The `frontend` job in `ci.yml` is `npm ci` → `npm run lint` → `npm run build` (i.e. `tsc -b && vite build`). `npm test` (`vitest run`) is not invoked anywhere, so e.g. `frontend/src/lib/sanitize.spec.ts` is not a gate.

So a green "frontend" check here means *it type-checks and bundles* — not *it works*. That is enough for a lockfile-only patch; it is not enough for 33 runtime-dependency updates.

Both gaps are worth GitHub issues in their own right (not filed — this run is read-only).

---

## Merge now

### #331 — dompurify 3.4.10 → 3.4.11 (frontend) ✅ security
The strongest candidate in the queue. `3.4.10` is vulnerable to **GHSA-cmwh-pvxp-8882** (medium): *permanent `ALLOWED_ATTR` pollution via `setConfig()` bypassing the hook clone-guard* — vulnerable range `<= 3.4.10`, first patched **3.4.11**.

This is not theoretical for us: `frontend/src/lib/sanitize.ts` is exactly the shape the advisory describes — it registers `DOMPurify.addHook('uponSanitizeElement'…)` and `addHook('afterSanitizeAttributes'…)` and then calls `DOMPurify.sanitize(html, {…})` with per-call config, and this sanitizer is what renders assistant/tool HTML in `MessageContent.tsx`. Patch-level bump, no API change, all checks green.

Caveat: #339 also carries dompurify (to 3.4.12), so these two overlap in `frontend/package.json`. Merging #331 first is the safer order — it lands the security fix without dragging in 32 other updates; Dependabot will rebase #339 on its own.

### #334 — github/codeql-action v3 → v4 ✅
Uniquely well-validated: `codeql.yml` is the workflow being changed, it runs on `pull_request`, and PR-triggered workflows execute from the *head* ref — so `Analyze (csharp)`, `Analyze (javascript-typescript)` and `Analyze (actions)` all **already ran on v4 and passed on this very PR**. CodeQL Action v3 is on GitHub's deprecation path; this is the migration. Merge.

### #329 — qs 6.15.1 → 6.15.3 (sample-client) ✅
`6.15.1` is vulnerable to **GHSA-q8mj-m7cp-5q26** (medium DoS: `qs.stringify` crashes on null/undefined entries in comma-format arrays with `encodeValuesOnly`), first patched `6.15.2`. Real, but the exposure is nil: `qs` is a transitive dep of `express` in `sample-client/`, a demo chatbot that appears in **no** `docker-compose*.yml`, no `deploy/` artifact and no workflow — it ships to nobody. The diff is `package-lock.json` only. Merge as housekeeping; it silences the alert at zero risk.

### #340 — dotenv 16.6.1 → 17.4.2 (e2e) ✅ (major, but safe here)
A major, so it deserves a look — and the look clears it. Our only call site is `e2e/playwright.config.ts:7`:

```ts
config({ path: resolve(__dirname, '.env'), override: false });
```

`config()`, `path` and `override` all survive v17 unchanged. The v17 line's user-visible change is log output (the `◇ injecting env (14) from .env` banner, later tightened, suppressible with `quiet`) — cosmetic stdout noise in a Playwright config, nothing parses it. Dev-only dependency, cannot reach production. Merge.

Note it lands **unverified** while E2E is disabled, but the failure mode is "noisy line in the test log", not a broken suite.

---

## Merge as one deliberate batch: #332, #333, #335, #337 (docker/* actions v3→v4 / v6→v7)

All four are the same release: **Node 24 as the default action runtime** (needs Actions Runner ≥ 2.327.1 — `ubuntu-latest` is well past that), plus a switch to ESM and removal of deprecated inputs/envs.

I checked our call sites against the removals and we use none of them:
- `build-push-action` v7 drops `DOCKER_BUILD_NO_SUMMARY` / `DOCKER_BUILD_EXPORT_RETENTION_DAYS` — `grep` over `.github/` finds neither. Our step (`release.yml:98`) passes only `context`, `file`, `push`, `platforms`, `build-args`, `tags`, `labels`, `cache-from`, `cache-to`, all still supported.
- `setup-buildx-action` v4 "removes deprecated inputs/outputs" — our uses (`release.yml:76`, `e2e.yml:27`) pass no inputs at all.
- `setup-qemu-action` v4 and `login-action` v4 — our uses pass nothing / only `registry`+`username`+`password`.

**The catch:** three of these four are used *only* in `release.yml`, which no PR check exercises, and the fourth (`setup-buildx`) is otherwise only in the disabled `e2e.yml`. So their green checks say nothing about them. If one of them breaks, you find out **when you cut a release**, and the multi-arch GHCR publish is the thing that breaks.

That's still an acceptable trade — the diffs are trivial, the deprecations don't touch us, and staying on v3 has its own decay cost. Merge them together so a release failure has one obvious suspect, and watch the first release run afterwards (or do them right *before* a planned release rather than right after one).

---

## Leave open

### #339 — npm-minor-patch group, 33 updates across /frontend and /e2e ⚠️
The one I would not merge on a green checkmark. It's "minor+patch" by version *number*, but that label is doing a lot of work:

- **`@assistant-ui/react` 0.14.12 → 0.14.26** (plus `react-ai-sdk` 1.3.31→1.3.40, `react-markdown` 0.14.1→0.14.5). A **0.x** package, so "patch" carries no semver promise, and this is 14 releases of churn including thread-list keyboard/focus rework and a new `sharedFocusGroup` prop. This is the Tracey assistant surface, which has a documented history of breaking in ways a type-check cannot see (thread state persistence silently losing messages).
- **`react-router-dom` 7.15.1 → 7.18.1** — three minors on the routing layer.
- **`@lingui/*` 6.4.0 → 6.5.0** — catalogs/macros; extraction isn't run in CI either.
- **`vite` 8.0.16 → 8.1.4**, `eslint` 10.3→10.7, `typescript-eslint` 8.59→8.63, `vitest`, `@playwright/test` 1.60.0→1.61.1 — build/lint/test tooling, genuinely low risk.
- **`dompurify` → 3.4.12** — the security fix, but #331 already gets you that on its own.

Its checks are green, but per the caveats above that green covers lint + `tsc` + bundle only — **no unit tests, no e2e**. A React-router / assistant-ui regression is precisely the class of bug that type-checks and bundles fine and then fails in the browser.

**What I'd do:** leave it open, re-enable the E2E workflow (and ideally add `npm test` to the frontend CI job), let those gates run on it, and merge if green. If you want it sooner, run `npm test` + the Playwright suite locally against the branch. If you want it *now* with minimal risk, ask Dependabot to split off the tooling-only half and hold the `@assistant-ui/*` + `react-router-dom` half.

### #336 / #341 / #342 — the Node 26 story 🔗
These three are one change wearing three hats, and merging them piecemeal makes the version skew worse, not better:

| Where | Node today | This PR wants |
|-------|-----------|---------------|
| CI (`ci.yml`, `e2e.yml` `setup-node`) | **22** | *(no PR)* |
| `frontend/Dockerfile` build + manual stages | **24** | 26 (#336) |
| `frontend` `@types/node` | 24 | 26 (#342) |
| `e2e` `@types/node` | 22 | 26 (#341) |

Merging #341/#342 alone puts the *types* two majors ahead of every runtime we actually execute on — code that compiles could still call an API absent on Node 22/24. It's dev-only and the frontend build is green, so it's not dangerous; it's just incoherent, and it buys nothing.

#336 is the more substantive one, and has two problems: **Node 26 is not LTS yet** (even-numbered releases enter LTS in October; in July 2026 Node 26 is still Current), and **nothing in PR CI builds `frontend/Dockerfile`** — the only PR-time job that would have (`e2e`) is disabled, so the release image build path is the first place a break would appear. Its build-stage-only role (`--platform=$BUILDPLATFORM`, final stage is nginx) limits the blast radius to build time, which is the one reassuring thing here.

**What I'd do:** leave all three open and do a single coordinated Node bump later — `setup-node` in `ci.yml`/`e2e.yml`, both `Dockerfile` stages, and both `@types/node` — once Node 26 hits LTS in October, with the e2e gate back on so the image actually gets built in CI. Nothing here is urgent: no security content, no functional gain.

---

## Suggested merge order

1. **#331** (dompurify security fix — smallest thing that closes a real advisory)
2. **#334** (codeql v4 — already proved itself)
3. **#329**, **#340** (zero-risk housekeeping)
4. **#332 + #333 + #335 + #337** as one batch, then watch the next release publish
5. Re-enable the E2E workflow + add `npm test` to CI → then revisit **#339**
6. Defer **#336 / #341 / #342** to one coordinated Node 26 bump (October, post-LTS)

## Evidence gathered (all read-only)

`gh pr list` · `gh pr view --json body` · `gh pr diff` · `gh pr checks` (snapshot, no `--watch`) · `gh run list` · `gh api /advisories/...` (dompurify, qs) · `gh api .../actions/workflows` (workflow states) · `gh api .../check-runs` · `git show origin/master:...`, `git ls-tree`, `git diff --stat` (no working-tree change) · `Read`/`grep` over `.github/`, `frontend/`, `e2e/`, `sample-client/`.
