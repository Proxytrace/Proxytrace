# Dependabot triage — DRY RUN (no PR was merged, closed, commented on, or checked out)

Repo: `Proxytrace/Proxytrace` · Date: 2026-07-12 · 12 open PRs labeled `dependencies`, all authored by `app/dependabot`.

## Headline finding — read this before merging anything

**The E2E workflow is disabled repo-wide.**

```
gh api repos/Proxytrace/Proxytrace/actions/workflows
  CI       .github/workflows/ci.yml      state=active
  CodeQL   .github/workflows/codeql.yml  state=active
  E2E      .github/workflows/e2e.yml     state=disabled_manually   <——
```

`e2e.yml` still declares `on: pull_request`, but because the workflow is disabled in the Actions UI it
**never runs** — no E2E check appears on any of the 12 PRs, and the most recent E2E run on any branch is
months old. So "green checks" on these PRs means only:

| Job | What it actually covers |
|---|---|
| `secrets` | gitleaks history scan |
| `frontend` | `npm ci` + `eslint` + `tsc -b && vite build` — **no `vitest`** (`npm test` is not in `ci.yml`) |
| `backend` | `dotnet restore/build/test` |
| CodeQL | static analysis (3 languages) |

Not covered by any check on these PRs: frontend unit tests, the whole `e2e/` directory (no typecheck, no run),
`frontend/Dockerfile` (only the disabled E2E workflow ever built images), and `release.yml` (only runs on a tag).
That gap is what drives the "leave open" verdicts below — the checks are green, but for several PRs green is
simply *silent*, not *safe*.

**Recommended first action, before any dependency merge: re-enable the E2E workflow** (Actions tab → E2E →
"Enable workflow", or `gh workflow enable e2e.yml`), let it run on the PRs, and re-triage. It was presumably
disabled while it was red; that redness is now hiding a lot.

## Decisions

| PR | Package (delta) | Ecosystem | Would do | Why |
|---|---|---|---|---|
| #331 | dompurify 3.4.10 → 3.4.11 | npm `/frontend` | **merge (first)** | Fixes open advisory GHSA-cmwh-pvxp-8882; patch-level; CI + CodeQL green |
| #329 | qs 6.15.1 → 6.15.3 | npm `/sample-client` | **merge** | Fixes open advisory GHSA-q8mj-m7cp-5q26; lockfile-only, demo app, not shipped |
| #334 | github/codeql-action 3 → 4 | actions | **merge** | Major = Node 24 runtime only; our inputs unchanged; **the PR's own green CodeQL run already exercises v4** |
| #332 | docker/login-action 3 → 4 | actions | **merge** | Node 24 runtime; `registry`/`username`/`password` inputs unchanged |
| #333 | docker/build-push-action 6 → 7 | actions | **merge** | Node 24 runtime; removed envs (`DOCKER_BUILD_NO_SUMMARY`, `DOCKER_BUILD_EXPORT_RETENTION_DAYS`) are **not** used here |
| #335 | docker/setup-qemu-action 3 → 4 | actions | **merge** | Node 24 runtime; we pass no inputs |
| #337 | docker/setup-buildx-action 3 → 4 | actions | **merge** | Node 24 runtime; v4 drops deprecated inputs — we pass none |
| #340 | dotenv 16.6.1 → 17.4.2 | npm `/e2e` (dev) | **merge** | Only v17 breaking change is `quiet` defaulting to false (an extra log line); our call is `config({path, override:false})` |
| #339 | npm-minor-patch group, 33 updates across `/frontend` + `/e2e` | npm | **leave open** → merge after a local `cd frontend && npm test` | Biggest blast radius (react, vite, react-router, assistant-ui, lingui, playwright) and it is exactly the PR CI covers least: no vitest, no e2e |
| #336 | node 24-alpine → 26-alpine | docker `/frontend` | **leave open** | Node 26 is **Current, not LTS until 2026-10-28**; and nothing in CI builds this Dockerfile |
| #341 | @types/node 22.19.19 → 26.1.1 | npm `/e2e` (dev) | **leave open** | `e2e/` has zero CI coverage right now; types would also run ahead of the Node we actually use |
| #342 | @types/node 24.12.4 → 26.1.1 | npm `/frontend` (dev) | **leave open** | Same Node-baseline decision as #336/#341 (typecheck does pass) |

Net: **8 would merge, 4 would stay open, 0 would be closed.** Nothing in this queue is affirmatively bad — the
four hold-backs are "needs a decision or a check I can't run read-only", not "reject".

## Security context

Six Dependabot alerts are open. Two of them are fixed by PRs in this queue:

| Advisory | Severity | Package | Fixed by |
|---|---|---|---|
| GHSA-cmwh-pvxp-8882 | medium | dompurify (`frontend`) | **#331** (also #339, which goes to 3.4.12) |
| GHSA-q8mj-m7cp-5q26 | medium | qs (`sample-client`) | **#329** |
| GHSA-fx2h-pf6j-xcff | high | vite (`manual`) | *no PR exists* |
| GHSA-4w7w-66w2-5vf9 | medium | vite (`manual`) | *no PR exists* |
| GHSA-v6wh-96g9-6wx3 | medium | vite (`manual`) | *no PR exists* |
| GHSA-67mh-4wv8-2f99 | medium | esbuild (`manual`) | *no PR exists* |

**The four `manual/` advisories have no PR at all** even though `/manual` is listed in `dependabot.yml`. Cause:
`manual/` depends on `vitepress ^1.6.3`, which pins the vulnerable vite/esbuild transitively — Dependabot cannot
fix them without a VitePress major (2.x). All four are dev-server / Windows-path issues in a docs toolchain, so
real exposure is low, but this should be tracked as its own piece of work (VitePress 2 upgrade), not left to rot.
It is not something the dependency queue will ever resolve on its own.

On #331 specifically: the advisory is about `setConfig()` permanently polluting `ALLOWED_ATTR` and bypassing the
hook clone-guard. `frontend/src/lib/sanitize.ts` calls `DOMPurify.addHook(...)` and passes config **per
`sanitize()` call**, never `setConfig()` — so we are not the exploitable pattern, but we are on the exact
hooks+config surface the patch hardens. Take the patch.

## Detail on the four hold-backs

**#339 — the 33-package minor/patch group.** Contents worth naming: react 19.2.5→19.2.7, vite 8.0.10→8.1.4,
react-router-dom 7.14.2→7.18.1, @tanstack/react-query 5.100.9→5.101.2, @assistant-ui/* 0.14.12→0.14.26,
@lingui/* 6.4→6.5, eslint 10.2.1→10.7.0, typescript-eslint 8.58→8.63, vitest 4.1.9→4.1.10, @playwright/test
1.52→1.61.1 (`/e2e`), dompurify →^3.4.12. All within-range minor/patch, no breaking notes of interest. The problem
is not the packages, it's the verification: CI runs lint + build for the frontend and *nothing at all* for `e2e/`,
and the E2E workflow that would have caught a runtime regression in react-router / react-query / assistant-ui is
disabled. This is the one PR where I'd insist on the local step from the skill's rubric (`cd frontend && npm ci &&
npm run build && npm test && npm run lint`) — which I did not run, per the read-only constraint. With a green
local vitest run, merge it.

**#336 — node 24-alpine → 26-alpine.** Two independent reasons to wait. (1) Per `nodejs/Release`, v26 started
2026-05-05 and does **not** reach LTS until 2026-10-28 — merging today ships a *Current* release in the production
frontend image, while the .NET images are on stable aspnet:10.0 and CI itself builds the frontend on Node 22. (2)
Its green checks are meaningless for this change: no active workflow builds `frontend/Dockerfile` (the E2E workflow
did, and it's disabled), so nothing has actually proven the image builds. Revisit after 2026-10-28, or once E2E is
back on. Not a close — Node 26 is fine, just early.

**#341 / #342 — @types/node → 26.** These are the same decision as #336 wearing a different hat: what Node do we
actually target? Right now the answer is three answers — CI uses Node 22, `frontend/Dockerfile` uses Node 24,
and these PRs would put the *types* on 26. Types ahead of the runtime let code typecheck against APIs that don't
exist at run time. #342 at least typechecks green (`tsc -b` runs in the `frontend` CI job). #341 has literally no
check that compiles `e2e/` at all. Decide the Node baseline (ideally: stay on 24 LTS now, move everything to 26
after October), then take the matching `@types/node`.

**Actions majors (#332/#333/#334/#335/#337) — a note, not a hold-back.** All five are the same upstream change:
Node 24 as the default action runtime, requiring Actions Runner ≥ 2.327.1 (GitHub-hosted runners are well past
that). I verified our workflows use no input/env that these majors removed. But be aware that four of the five
(`setup-qemu`, `setup-buildx`, `login`, `build-push`) are used **only in `release.yml`**, which does not run on
pull requests — so their green PR checks prove nothing about them. First real proof is the next tag. After merging,
cut a throwaway `-rc` tag to exercise the release path before you rely on it for a real release. #334
(codeql-action) is the exception and the safest of the five: `pull_request` runs the PR's own workflow file, so the
green `Analyze (*)` checks on that PR *are* CodeQL v4 running.

## Suggested order (if/when you go live)

1. Re-enable the E2E workflow; let it run; fix or accept whatever it says.
2. #331 (dompurify security patch) — small and targeted.
3. #329 (qs security patch) — independent lockfile, no conflict.
4. #334, then #332/#333/#335/#337 (actions majors) — then an `-rc` tag to prove `release.yml`.
5. #340 (dotenv).
6. #339 last of the mergeable set — it rebases over the dompurify bump, and it's the one that most needs the
   restored E2E signal. Run frontend vitest locally first.
7. #336/#341/#342 — park until the Node-baseline decision (revisit ~2026-10-28).

Each merge invalidates the other npm PRs' lockfiles, so re-check `mergeable` and let checks re-run between steps;
never merge on stale green.

## Out-of-scope problems worth filing as issues

Three things surfaced here that are not any one PR's fault and will keep biting:

1. **E2E workflow disabled** — the repo's main integration gate is silently off; every PR merged since then went in
   unguarded.
2. **`ci.yml` never runs frontend unit tests** — `npm test` (vitest) exists in `frontend/package.json` but no job
   invokes it; and no job typechecks `e2e/`.
3. **`manual/`'s four vite/esbuild advisories are unfixable via Dependabot** — needs a VitePress 2.x upgrade.

I did not file these (read-only dry run).
