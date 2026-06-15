# Manual Screenshot Backlog

Which manual pages still need screenshots, and roughly which shots. **Per-page count is highly
individual — some pages want several shots, some want one, many want none.** These are suggestions,
not a quota: capture what genuinely makes the prose clearer.

Capture with the `manual-screenshots` skill (`.claude/skills/manual-screenshots/SKILL.md`): boot
`docker-compose.kiosk.yml`, shoot with `manual/screenshots/capture-lib.mjs`, embed
`![alt](/screenshots/<page-slug>/<shot>.png)`, verify `npm run docs:build`, tear down.

**Legend** — Status: `[x]` done · `[ ]` todo · 🚫 not representable in kiosk (no auth/users/real
LLM) → needs a non-kiosk stack or is out of scope. Priority: **P1** high-value & visual · **P2**
nice-to-have · **P3** optional. Filenames are suggestions. "verify" = confirm the page/data actually
renders in kiosk when you get to it.

---

## User Guide (`manual/guide/`)

### dashboard.md — ✅ done
- [x] `dashboard/overview.png` — `/dashboard` top fold (Mission Control + metrics + charts + live stream + pass-rate gauge)

### capturing-traces.md — P1 (richest page; kiosk has seeded traces)
- [ ] `traces/list.png` — `/traces` populated list
- [ ] `traces/timeline.png` — the timeline view
- [ ] `traces/detail.png` — trace detail panel (open one trace)
- [ ] `traces/conversation.png` — multi-turn conversation in the detail panel · P2
- [ ] `traces/filters.png` — search / filter / paging bar (crop) · P2

### agents.md — P1
- [ ] `agents/list.png` — `/agents` list (seeded "Data Analytics Agent")
- [ ] `agents/detail.png` — the agent detail view
- [ ] `agents/versioning.png` — version history / versioning UI · P3 (if surfaced)

### evaluators.md — P1
- [ ] `evaluators/list.png` — `/evaluators` list (seeded "Helpfulness")
- [ ] `evaluators/workspace.png` — the evaluator workspace / detail
- [ ] `evaluators/playground.png` — `/evaluator-playground`, a rule-based check run · P2

### test-suites-and-cases.md — P1 (verify suites are seeded)
- [ ] `suites/overview.png` — `/suites` overview
- [ ] `suites/cases.png` — suite detail: the test-case list
- [ ] `suites/expected-output.png` — editing a case's expected output · P2
- [ ] `suites/attach-evaluators.png` — attaching evaluators to a suite · P3

### running-tests.md — P1 (verify a seeded, completed run exists)
- [ ] `runs/results-matrix.png` — completed run → test-case matrix
- [ ] `runs/per-model.png` — per-model performance summary
- [ ] `runs/progress.png` — a run in progress / live view · P2 (needs an active run)
- [ ] `runs/ab.png` — an A/B validation run · P3

### optimization-proposals.md — P2 (verify proposals are seeded)
- [ ] `proposals/list.png` — `/proposals` list
- [ ] `proposals/detail.png` — proposal detail (contents + suggested change)

### optimization-theories.md — P2 (verify theories are seeded)
- [ ] `theories/board.png` — `/theories` board
- [ ] `theories/detail.png` — theory detail + validation lifecycle

### proxy-setup.md — P2 (mostly client code/env; one UI moment)
- [ ] `proxy-setup/create-api-key.png` — the API-key creation UI/dialog · verify kiosk exposes key management; else this page stays code-only

### tracey.md — P2, **partial** (Enterprise; kiosk has no live LLM)
- [ ] `tracey/opening-view.png` — Tracey panel opening view (static UI)
- [ ] `tracey/menu.png` — quick actions / chips / the "/" menu (static UI)
- 🚫 live answers, inline components, tool calls, skills-in-action — need an **LLM-backed** kiosk (the "interactive kiosk" with a real endpoint, see admin/configuration.md). The plain kiosk can't generate responses.

### getting-started.md — P3 (conceptual; 0 is fine)
- [ ] `getting-started/overview.png` — one optional orientation shot (could reuse the dashboard) · P3

### index.md — none
Home/hero layout — no product screenshot required. (Optional: a single hero image later.)

---

## Operations (`manual/admin/`)

Most admin pages are configuration/CLI/ops with no product UI, or describe things kiosk can't show.

### providers-and-api-keys.md — P2 (verify providers/keys UI renders in kiosk)
- [ ] `providers/list.png` — providers / models list
- [ ] `providers/add-provider.png` — the add-provider dialog (auto-loads models & prices)
- [ ] `providers/issue-key.png` — issuing an API key · P2

### data-retention.md — P3 (verify the retention page renders in kiosk)
- [ ] `data-retention/page.png` — the Data Retention settings page

### error-log.md — P3 (admin page; kiosk likely has no seeded errors → low value)
- [ ] `error-log/page.png` — the Error Log page · verify it renders + has rows

### licensing.md — P3 (kiosk license is fixed Enterprise)
- [ ] `licensing/status.png` — license status / activation UI · verify representable

### user-management.md — 🚫 not in kiosk
No auth/users in kiosk. Needs a non-kiosk stack (out of scope for the current skill) — leave without screenshots for now.

### configuration.md — none (appsettings / env; no UI)
### database.md — none (storage modes / migrations; CLI)
### deployment.md — none (Docker Compose shapes; ops)
### installation.md — none (install steps; CLI)
### upgrading.md — none (release/ops; CLI)
### e2e-tests.md — none (CLI; an optional Playwright HTML-report shot would not be app UI)
