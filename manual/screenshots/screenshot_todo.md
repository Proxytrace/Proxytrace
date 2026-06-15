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

### capturing-traces.md — ✅ P1 done
- [x] `traces/list.png` — `/traces` (timeline + summary cards + table) → under "Exploring traces"
- [x] `traces/timeline.png` — timeline-strip crop → under "The timeline"
- [x] `traces/detail.png` — trace detail drawer (conversation + metrics) → under "The trace detail panel"
- [x] `traces/filters.png` — covered by `list.png` (the filter/paging bar is visible there); no separate crop
- [x] `traces/conversation.png` — a multi-turn conversation group expanded → under "Multi-turn conversations"

### agents.md — ✅ P1 done
- [x] `agents/detail.png` — the agent detail view (the agent list rail is visible in the same shot) → under "The agent detail view"
- [x] `agents/list.png` — folded into `detail.png`; separate rail crop dropped as redundant
- [ ] `agents/versioning.png` — version-history close-up · P3 (optional; not done)

### evaluators.md — ✅ P1 done
- [x] `evaluators/workspace.png` — the evaluator workspace (rail + detail) → under "The evaluator workspace"
- [x] `evaluators/playground.png` — the Evaluator Playground (rail + bench + verdict) → under "The Evaluator Playground"
- [x] `evaluators/list.png` — folded into `workspace.png`; separate rail crop dropped as redundant

### test-suites-and-cases.md — ✅ P1 done
- [x] `suites/overview.png` — `/suites` overview grid + totals → under "The suites overview"
- [x] `suites/cases.png` — the Edit Suite dialog (cases + expected-output editor + tabs) → under "Test cases"
- [x] `suites/expected-output.png` — covered by `cases.png` (the expected-output editor is shown)
- [x] `suites/attach-evaluators.png` — covered by `cases.png` (the Evaluators tab is in the dialog)

### running-tests.md — ✅ P1 done
- [x] `runs/results.png` — completed run: model cards + evaluator breakdown + test-case matrix → under "Test case matrix"
- [x] `runs/per-model.png` — per-model performance summary crop → under "Per-model performance summary"
- [ ] `runs/progress.png` — a run in progress / live SSE view · P2 (needs an active run; not done)
- [ ] `runs/ab.png` — an A/B validation run · P3

### optimization-proposals.md — ✅ P2 done
- [x] `proposals/detail.png` — the validated-theory proposal drawer (gain + prompt diff + Promote/Dismiss) → under "What a proposal contains"
- Note: `/proposals` renders the Theories board (see optimization-theories.md); the per-proposal UI is the review drawer above, not a separate list.

### optimization-theories.md — ✅ P2 done
- [x] `theories/board.png` — the Optimization Theories kanban (`/proposals`) → under "Reviewing the board"
- Note: there is no `/theories` route — the board lives at `/proposals`; the validated-theory drawer is embedded on the Proposals page as `proposals/detail.png`.

### proxy-setup.md — 🚫 API-key UI kiosk-gated
- 🚫 `proxy-setup/create-api-key.png` — API keys live under `/settings/providers`, which redirects to the dashboard in kiosk. Needs a non-kiosk admin stack; page stays code-only for now.

### tracey.md — ✅ P2 (static UI) done
- [x] `tracey/opening-view.png` — opening view: chips + compose → under "The opening view"
- [x] `tracey/menu.png` — the "/" quick-actions + tools menu → under "Quick actions, chips, and the / menu"
- 🚫 live answers, inline components, tool calls, skills-in-action — need an LLM-backed (interactive) kiosk; the plain kiosk renders only the static UI.

### getting-started.md — P3 (conceptual; 0 is fine)
- [ ] `getting-started/overview.png` — one optional orientation shot (could reuse the dashboard) · P3

### index.md — none
Home/hero layout — no product screenshot required. (Optional: a single hero image later.)

---

## Operations (`manual/admin/`)

Most admin pages are configuration/CLI/ops with no product UI. **Confirmed: every settings/admin route (`/settings/*`) redirects to the dashboard in kiosk (admin-gated)** — so providers, API keys, users, license, retention, and error-log are **not capturable in kiosk**. They need a non-kiosk, authenticated-admin stack (out of scope for the current skill).

### providers-and-api-keys.md — 🚫 kiosk-gated (`/settings/providers` → dashboard)
Wanted (non-kiosk admin stack): providers/models list, the add-provider dialog, issuing an API key.

### data-retention.md — 🚫 kiosk-gated (`/settings/retention` → dashboard)
Wanted (non-kiosk admin stack): the Data Retention settings page.

### error-log.md — 🚫 kiosk-gated (`/settings/error-log` → dashboard)
Wanted (non-kiosk admin stack): the Error Log page.

### licensing.md — 🚫 kiosk-gated (`/settings/license` → dashboard)
Wanted (non-kiosk admin stack): the license status / activation UI.

### user-management.md — 🚫 not in kiosk
No auth/users in kiosk. Needs a non-kiosk stack (out of scope for the current skill) — leave without screenshots for now.

### configuration.md — none (appsettings / env; no UI)
### database.md — none (storage modes / migrations; CLI)
### deployment.md — none (Docker Compose shapes; ops)
### installation.md — none (install steps; CLI)
### upgrading.md — none (release/ops; CLI)
### e2e-tests.md — none (CLI; an optional Playwright HTML-report shot would not be app UI)
