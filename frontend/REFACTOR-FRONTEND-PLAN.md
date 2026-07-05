# Refactor Frontend Plan — 2026-07-05

Baseline: build + lint + 835 tests green before any change.

## Scan summary

Codebase is close to BEST_PRACTICES target state. Scanner top hits are mostly
sanctioned exceptions or false positives (see Exceptions). Real items below.

## Items

### Wave 1 — shared modules (parallel; disjoint files)

- [x] **W1-A (P2): Extract React query hooks out of `api/license.ts`** (139 lines, 5 raw useQuery/useMutation).
      Smell: §3.1 layering — `api/*.ts` must be "thin typed functions returning DTOs. No React, no query logic".
      Approach: keep types + pure `licenseApi` functions in `api/license.ts`; move `useQuery`/`useMutation` hooks
      to a new `hooks/useLicense.ts` (cross-feature — consumed by suites, runs, evaluators, setup, settings,
      components/license). Update all imports. Behavior identical.
      Files: `api/license.ts`, new `hooks/useLicense.ts`, consumers:
      `features/suites/components/SuiteSchedulesSection.tsx`, `features/suites/components/EvaluatorsPanel.tsx`,
      `features/runs/components/SchedulesSection.tsx`, `features/evaluators/components/NewEvaluatorModal.tsx`,
      `features/setup/**`, `features/settings/sections/LicenseSection.tsx`, `components/license/RequiresFeature.tsx`.

- [x] **W1-B (P2): Split `components/charts/chart-math.ts`** — DONE: barrel + 5 modules (scale/cartesian/stacked/timeline/gauge), zero consumer churn. (320 lines > 300 hard limit, pure lib).
      Approach: split by concern into sibling modules (e.g. scales/log-span vs path/geometry helpers) with the
      existing import path preserved via re-exports from `chart-math.ts`, or move `chart-math.ts` to a folder
      barrel. Keep both spec files passing unchanged.
      Files: `components/charts/chart-math.ts` (+ new siblings), specs read-only.

### Wave 2 — feature folders (parallel; disjoint folders)

- [x] **W2-A (P2): Decompose Tracey oversized files** — one agent, sequential steps; MUST read
      `frontend/docs/TRACEY.md` first.
      1. `features/tracey/useTraceyChat.ts` (392): extract pure history/persistence helpers
         (`unionArtifactRefs`, `loadHistory`, …) to a `.ts` lib file (+ spec if risky), keep hook thin.
      2. `features/tracey/tracey-runtime.ts` (326): split `TraceyTransport` class, message-window/skill helpers,
         and `buildAiTools` into cohesive modules; re-export to keep import surface.
      3. `features/tracey/tracey-storage.ts` (319): split thread-snapshot storage vs conversation-index concerns.
      Files: `features/tracey/*` only.

- [x] **W2-B (P2): Split `features/dashboard/dashboardMeta.ts`** — DONE: 367→56 barrel + tokenSeries/latency/agentFleet/modelSplit/pulse. (367 > 300; pure meta, 29 exports; has spec).
      Approach: split into cohesive meta modules (keep `dashboardMeta.ts` as barrel or update imports within
      the dashboard folder). NOTE: dashboard folder holds uncommitted user WIP — preserve all current behavior,
      touch only what the split requires. `dashboardMeta.spec.ts` must pass unchanged.
      Files: `features/dashboard/dashboardMeta.ts` (+ new siblings), dashboard component imports.

- [x] **W2-C (P2): Decompose `features/playground/components/RightRailDrawer.tsx`** — DONE: 250→98 + SystemSection/ParametersSection/ReasoningEffortControl. (250 lines, 4 component fns; §1).
      Approach: extract inner components into sibling files under `features/playground/components/`.
      Files: `features/playground/components/RightRailDrawer.tsx` + new siblings.

- [x] **W2-D (P3): Decompose `features/auth/Login.tsx`** — DONE: 186→14 + OidcLogin/LocalLogin/LegacyClaim. (186 lines, 4 component fns; §1/§2).
      Approach: extract subcomponents to `features/auth/components/`; page stays orchestrator.
      Files: `features/auth/Login.tsx` + new `features/auth/components/*`.

### Wave 3 — follow-up findings

- [x] **W3-A (P4): Dedupe bar-rect geometry in charts** — DONE: chart-bars.ts (barBand/barsRectPath/pads), fuzz-verified bit-identical, 21/21 specs. (reported by W1-B): `computeHistogram`,
      `computeModelBars`, `computeStackedBar` re-derive near-identical bar-rect + barsPath geometry with
      repeated pad literals (padL=38 …). Extract a shared helper in `components/charts/`; existing 21 chart
      specs must pass unchanged (output-identical).

- [x] **W3-B (P3): Auth card-shell reuse** — DONE: AuthCard size prop ('md'|'lg'), LocalLogin/LegacyClaim reuse it, pixel-identical. useAuthForm extraction deliberately skipped: the three forms' submit control flows differ non-cosmetically (guard placement, MFA branch) — unification would risk ordering bugs. (reported by W2-D): `LocalLogin.tsx` duplicates the exact
      `AuthCard` shell classes (`w-80 rounded-xl border-border bg-surface-2 p-6 shadow`), `LegacyClaim.tsx`
      the same at `w-96`. Give `AuthCard` a width prop (default `w-80`) and reuse it in both. §7 "no new
      primitive when one exists". Optionally extract the duplicated email/password/err/submitting submit
      pattern into a small shared `useAuthForm` hook in `features/auth/hooks/` — only if provably
      behavior-identical.

- [x] **W3-C (P4): Slim `ParametersSection` props** — DONE: 5→3 props, setParam/setParamRaw internalized (pure derivation of onChange+overrides). (reported by W2-C): 5 props at soft limit;
      `setParam`/`setParamRaw` derivable from `onChange`+`overrides` — internalize to shrink the interface.

## Deferred (documented)

- Tracey `useTraceyChat` hook body still ~269 lines incl. a ~60-line restore/persist effect; fully closing
  the 120-line hook soft target requires lifting shared refs + the restore effect into a sub-hook — riskier
  restructure than a behavior-preserving refactor warrants now. File hard limit met; deferred deliberately.

## Wave schedule

- Wave 1: W1-A, W1-B (disjoint: license/api+hooks+consumers vs charts)
- Wave 2: W2-A (tracey), W2-B (dashboard), W2-C (playground), W2-D (auth) — disjoint feature folders

## Documented exceptions (no action, with reason)

- `features/tracey/knowledge/docs-index.generated.ts` (15968) — generated artifact.
- `api/models.ts` (1327) — doc-sanctioned single DTO registry (BEST_PRACTICES §10 "DTOs live in api/models.ts");
  splitting churns 100+ imports for no clarity gain.
- `components/icons/*` — sanctioned single icon module (§6); component count by design.
- `components/ui/Menu.tsx`, `components/ui/Card.tsx` — compound components (Menu.Item, Card.Header/Body/Footer).
- `*.spec.ts` over 300 lines (tracey-tools, results) — test suites; splitting adds no clarity.
- `features/traces/components/TraceTableCells.tsx` (7 fns, 97 lines) — deliberate cohesive cell-renderer
  cluster, each <20 lines, documented in-file; 7 twelve-line files would be worse.
- `features/suites/components/TestCasePreview.tsx` (40 ln/4 fns), `features/evaluator-playground/components/PastEvaluationPreview.tsx` (79 ln/4 fns) — tiny private render helpers <20 lines each (§1 exception).
- Scanner `!` hits (password.spec, ingestionSnippets, CodeBlock, RecentRunStrip) — false positives:
  exclamation marks in strings and Tailwind `w-auto!` important modifier. Zero real non-null asserts.
- Inline `style={{}}` hits sampled across dashboard/agents/runs/traces/ui — all runtime-computed
  (agentColor/modelColor/statusColor hexes, percent widths, gridTemplateColumns) — allowed per §7/§13.
- Inline `<svg>` outside icons: `RadialScore` (gauge), `ChartArtifact` (chart), `PulseBand` (EKG) — data-viz,
  allowed per §6; `components/ui/BrandMark.tsx` — brand logo, not an icon glyph.
- `raw_query` hits in `features/*/hooks/use*.ts` — that IS the prescribed home for useQuery (§3.1).
- No `any`/`as any` anywhere in non-spec source. No raw `useQuery` in pages.
