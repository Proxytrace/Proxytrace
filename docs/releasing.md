# Releasing

How Proxytrace versions are defined, how a release is cut, and what the release pipeline
produces. Read this before touching versioning, the release workflow, or the deploy artifact.

## Version single source of truth: the git tag

The release version is defined **only** by the annotated git tag `vX.Y.Z` (SemVer). There is
no VERSION file and no version field to bump in `package.json`/csproj — nothing in-repo can
drift from the tag.

Propagation:

- `Directory.Build.props` defaults `Version` to `0.0.0-dev`; the release workflow overrides it
  with `-p:Version=X.Y.Z` (via the `APP_VERSION` Docker build arg in all Dockerfiles). MSBuild
  derives `AssemblyVersion`/`FileVersion` (`X.Y.Z.0`) and `AssemblyInformationalVersion` (the
  full SemVer incl. prerelease suffix) from it. `IncludeSourceRevisionInInformationalVersion`
  is disabled so no `+<sha>` suffix leaks into UI strings.
- Backend code reads the version **only** through `IAppVersion`
  (`Proxytrace.Common/Hosting/IAppVersion.cs`, registered in `Common.Module`), which reads the
  `AssemblyInformationalVersionAttribute`. Never read `Assembly.GetName().Version` (it loses
  the prerelease suffix). Consumers: dashboard telemetry, the license-server check payload,
  `GET /api/config` (`version` field), and the update check.
- Frontend builds bake `__APP_VERSION__` via the `define` block in `frontend/vite.config.ts`
  (fed by the `VITE_APP_VERSION` env var / `APP_VERSION` build arg). The SPA primarily shows
  the backend-reported version from `/api/config`.
- Dev builds everywhere self-identify as `0.0.0-dev` (which also disables the update check).

## Cutting a release

> Agent-assisted releases: invoke the `release` skill (`.claude/skills/release/SKILL.md`) —
> it walks pre-flight checks, the changelog roll, tag push, workflow monitoring, and
> post-release verification, including failure recovery.

1. On `master`, move the `CHANGELOG.md` `[Unreleased]` content under a new
   `## [X.Y.Z] - YYYY-MM-DD` heading (the workflow fails fast if this section is missing).
2. Tag and push:

   ```bash
   git tag -a vX.Y.Z -m "Proxytrace X.Y.Z"
   git push origin vX.Y.Z
   ```

3. `.github/workflows/release.yml` does the rest (see below). Prerelease tags
   (`v1.2.0-rc.1`) work too: they publish only their exact image tag (no `latest`/rolling
   tags) and create a GitHub prerelease.

## What the release workflow does

`release.yml` (trigger: tag push `v*.*.*`, serialized via a `release` concurrency group):

1. **meta** — validates the tag is SemVer and that `CHANGELOG.md` has the matching section
   (`scripts/release/extract-changelog.sh`).
2. **ci / e2e** — reuses the existing `ci.yml` and `e2e.yml` workflows as release gates
   (both expose `workflow_call`).
3. **publish-images** — builds and pushes `ghcr.io/proxytrace/proxytrace-{api,proxy,frontend}`
   (multi-arch: linux/amd64 + linux/arm64; build stages cross-compile natively via
   `--platform=$BUILDPLATFORM` + `dotnet -a $TARGETARCH`, QEMU only runs the trivial
   runtime-stage RUN commands) with
   `APP_VERSION` injected, tagged `X.Y.Z`, `X.Y`, `X`, and `latest`
   (rolling tags suppressed for prereleases). When the `DOCKERHUB_USERNAME` /
   `DOCKERHUB_TOKEN` repo secrets are set the identical images + tags are **also** mirrored to
   Docker Hub (`docker.io/proxytrace/proxytrace-{api,proxy,frontend}`) in the same buildx push;
   with the secrets absent it publishes to GHCR only (Docker Hub is never a release-breaking
   dependency). **GHCR stays the source of truth** — the deploy compose (below) pins `ghcr.io`
   images; Docker Hub is a convenience mirror (`docker pull proxytrace/proxytrace-api`).
4. **release** — pins the version into `deploy/docker-compose.yml` (replacing the
   `${PROXYTRACE_VERSION:-latest}` placeholder), zips it with `deploy/.env.example` +
   `deploy/README.md`, extracts the changelog section as release notes, and creates the
   GitHub release with the zip attached **as a draft** (`gh release create --draft`).

A drafted release is hidden from the public Releases API, so the update banner (below) does
not fire until a human publishes it. **The customer-facing go-live is the manual "Publish
release" click** in the GitHub UI (or `gh release edit vX.Y.Z --draft=false`), not the tag
push. Note the rolling image tags (`latest`/`X.Y`/`X`) still move at the publish-images step,
before the release is published — customers pin versions and the banner is API-driven, so
this is harmless, but `latest` advances ahead of the release going live.

## Source protection in shipped images

Self-hosted .NET ships decompilable IL — accepted (the protection model is licensing +
the proprietary LICENSE, like every commercial self-hosted product). The cheap hardening
that *is* applied: backend Dockerfiles publish with `-p:DebugType=none`, so released images
contain **no PDBs** — which would otherwise carry line-accurate symbols and a SourceLink map
revealing the private repo URL + commit SHA. Consequence: production stacktraces (error log)
have full frames but no file/line numbers; pair them with the reported version to locate
code. Don't reintroduce PDBs into images, and don't bother with IL obfuscators — the
reflection-based Autofac/EF discovery breaks under renaming. Frontend ships minified bundles
without sourcemaps (Vite default — don't enable `build.sourcemap` for production).

## The deploy artifact (`deploy/`)

`deploy/docker-compose.yml` is the customer-facing install: pinned GHCR images, postgres 16 +
redis, healthchecks, restart policies, named volumes (`pgdata`, `searchindex`), and required
secrets enforced via `${VAR:?}` (see `deploy/.env.example`). The in-repo copy tracks `latest`;
the released zip is fully pinned. Keep it runnable from a bare directory containing only the
three artifact files — it must never reference repo paths (which is why `frontend/nginx.conf`
is baked into the frontend image).

## Changelog discipline

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com): user-facing changes are
added to `[Unreleased]` **in the same PR** that makes them (CLAUDE.md hard rule). The release
workflow turns the version's section into the GitHub release notes verbatim.

## Update notification

The app polls the GitHub releases feed daily (`UpdateCheckService`,
`Proxytrace.Application/Updates/`) and surfaces an admin-only banner when a newer version
exists. Config section `Updates` (`Enabled`, `ManifestUrl`, `CheckIntervalHours`); admin
endpoint `GET /api/updates`. Disabled in kiosk mode and for `0.0.0-dev` builds. Operator docs:
`manual/admin/configuration.md` (§ Update notifications).

## One-time setup notes (first release)

- After the first image push, set the GHCR packages to **public** and link them to the repo
  (GitHub UI; not automatable from the workflow).
- The org must allow `GITHUB_TOKEN` package creation (org settings → Packages).
- E2E gates use `secrets: inherit` for `OPENAI_API_KEY` (LLM specs are skipped without it).

### Docker Hub mirror (optional)

The `publish-images` job mirrors to Docker Hub only when both repo secrets exist; leaving them
unset keeps the release GHCR-only. To enable the mirror:

1. Create (or claim) the `proxytrace` **organization** on Docker Hub. Public repos are free
   with unlimited storage; the three image repos (`proxytrace-api`, `proxytrace-proxy`,
   `proxytrace-frontend`) are auto-created on first push — but create them up front if you want
   them public from the start (new repos default to public for a free org, private for paid).
2. Generate a **Read & Write access token** (Docker Hub → Account/Org Settings → Personal
   access tokens / Access tokens) — do **not** use the account password.
3. Add two repository secrets (Settings → Secrets and variables → Actions):
   - `DOCKERHUB_USERNAME` — the Docker Hub user or org that owns the token
   - `DOCKERHUB_TOKEN` — the access token from step 2
4. Cut a release as usual. The next tag push mirrors all three images (multi-arch, same
   `X.Y.Z`/`X.Y`/`X`/`latest` tags) to `docker.io/proxytrace/...` alongside GHCR.

Cost: **none** for public images (unlimited public repos + storage on the free tier). Docker
Hub's pull rate limits apply to *consumers* (anonymous 100 / free-authenticated 200 pulls per
6 h), not the publisher; GHCR remains an unlimited fallback, so pinning the deploy compose to
GHCR keeps installs unaffected.
