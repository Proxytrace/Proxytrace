# Frontend refactor plan

Baseline: `npm run build && npm run lint && npm test` — all green (154 tests pass).

The well-known monsters cited in `BEST_PRACTICES.md` (Evaluators.tsx, Dashboard.tsx,
Providers.tsx, Traces.tsx, Setup.tsx) have already been refactored away. The remaining
work is medium- and low-impact maintainability + a focused security pass.

## Documented exceptions (no action)

- `frontend/src/components/icons/index.tsx` — 438 lines, 49 components, 5 SVGs. This is
  the **sanctioned single icon module** per BEST_PRACTICES §6. Splitting would harm
  discoverability and is explicitly called out as a non-target by the skill.
- `frontend/src/api/models.ts` — 639 lines, pure type/interface/enum declarations, 0
  forbidden constructs. DTO contract files are an explicit acceptable shape;
  splitting by resource buys nothing concrete here.
- `frontend/src/features/traces/components/TraceTableCells.tsx` — 5 components, 2
  inline styles. Each component is <20 lines per the explicit file header ("a tiny
  presentational component (< 20 lines) with no state"); the inline styles use
  runtime-computed colors from `agentColor` / `modelColor` (allowed by §13).
- `frontend/src/components/ui/Card.tsx` — Compound-component pattern
  (`Card.Header/Body/Footer`). Each sub-component <20 lines, inline styles are
  runtime-computed (`accentBar`, `hoverGlow` props).
- `frontend/src/features/runs/components/EvaluatorHeatmap.tsx`,
  `ModelLeaderboardCard.tsx`, `ChartsWidget.tsx`,
  `frontend/src/components/search/SearchPreview.tsx` — small private render-helpers
  (each <20 lines), permitted per the §1 exception.
- `frontend/src/features/playground/hooks/usePlaygroundAgent.ts` — 4 useEffects, each
  one already documented with an inline comment explaining why a Query cannot replace
  it (router param sync, reducer-dispatch side-effects on data, auto-load seeding).
- Scanner false positives for `!`: `CodeBlock.tsx`, `Invites.tsx` — those are logical
  NOT operators and `"Copied!"` string literals, not non-null assertions.

## Backlog (priority-ordered)

### Wave 0 — Security review (serial, runs first, mostly read-only)

- [ ] **S1.** Sweep the frontend for §12 (secure programming) violations:
  `dangerouslySetInnerHTML`, `eval`/`new Function`, unsanitized data-derived
  `href`/`src`, `target="_blank"` without `rel="noopener noreferrer"`, sensitive data
  in `console.log` or `localStorage`/`sessionStorage`. Fix any real findings in
  scope; otherwise report clean. Also: run `npm audit` and report. Files: any.

### Wave 1 — Parallel feature refactors (disjoint files)

- [ ] **P1.** Split `App.tsx` (223 lines, 7 components) into focused files.
  - Files in scope: `src/App.tsx`, new `src/auth/AuthGates.tsx`, new
    `src/auth/AppRoutes.tsx`, new `src/components/layout/PageLoader.tsx`,
    new `src/auth/KioskShell.tsx`, new `src/auth/ModeShell.tsx`.
  - Smell: BEST_PRACTICES §1 — more than 2 component functions per file.

- [ ] **P2.** `PromoteModal.tsx` (262 lines, 3 components, inline query-key,
  threaded color prop).
  - Files in scope: `src/features/traces/PromoteModal.tsx`, new
    `src/features/traces/components/SuiteStats.tsx`, new
    `src/features/traces/hooks/useAddTestCase.ts`.
  - Smells: §1 (3 components), §3.2 (inline `['test-suites']` key →
    `QUERY_KEYS.testSuites`), §3 (raw `useMutation` in component), §5.1 (threaded
    `accent: 'var(--...)'` color prop on inner Stat).

- [ ] **P3.** `EndpointSelector.tsx` — extract data layer, fix query key, fix
  invalidation predicate.
  - Files in scope: `src/features/agents/EndpointSelector.tsx`, new
    `src/features/agents/hooks/useEndpointSwitcher.ts`.
  - Smells: §3.2 (inline `['all-endpoints']` → `QUERY_KEYS.modelEndpoints`), §3
    (raw `useQuery`/`useMutation` in component), invalidation predicate string
    `q.queryKey[0] === 'agents'` (use `QUERY_KEYS.agents` prefix).

- [ ] **P4.** Split `RightRailDrawer.tsx` (264 lines, 4 components).
  - Files in scope: `src/features/playground/components/RightRailDrawer.tsx`, new
    `src/features/playground/components/SystemSection.tsx`,
    `src/features/playground/components/ParametersSection.tsx`,
    `src/features/playground/components/ReasoningEffortControl.tsx`.
  - Smell: §1 (>2 component functions per file).

- [ ] **P5.** `TestCasesPanel.tsx` (256 lines, 3 components, `<li onClick>`,
  static inline styles).
  - Files in scope: `src/features/suites/EditSuiteDialog/TestCasesPanel.tsx`,
    new `src/features/suites/EditSuiteDialog/CurrentCasesList.tsx`,
    `src/features/suites/EditSuiteDialog/AddTracesList.tsx`,
    `src/features/suites/EditSuiteDialog/hooks/useTracesForSuiteEdit.ts`.
  - Smells: §1 (3 components), §3 (raw `useQuery` in component), §11
    (`<li onClick>` for clickable list rows), §13 (static `style={{}}` with
    border-left/background that are class-expressible).

- [ ] **P6.** `TraceDetailPanel.tsx` — extract suites data hook + button-ify backdrop.
  - Files in scope: `src/features/traces/components/TraceDetailPanel.tsx`,
    new `src/features/traces/hooks/useTraceSuites.ts`.
  - Smells: §3 (raw `useQuery` in component), §11 (`<div onClick>` backdrop —
    replace with `<button>` or aria attributes).

- [ ] **P7.** `ComposeBox.tsx` — fix inline query key only (light touch).
  - Files in scope: `src/features/playground/components/ComposeBox.tsx`.
  - Smell: §3.2 (inline `['model-endpoints']` → `QUERY_KEYS.modelEndpoints`).

- [ ] **P8.** Split `KpiWidgets.tsx` (4 component functions per file).
  - Files in scope: `src/features/agents/widgets/KpiWidgets.tsx`, new
    `src/features/agents/widgets/KpiTraces.tsx`,
    `src/features/agents/widgets/KpiTokens.tsx`,
    `src/features/agents/widgets/KpiCost.tsx`,
    `src/features/agents/widgets/KpiLatency.tsx`. Update all importers.
  - Smell: §1 (>2 components per file).

- [ ] **P9.** `AbTestHero.tsx` (160 lines, 3 components, 9 inline static styles).
  - Files in scope: `src/features/proposals/AbTestHero.tsx`, new
    `src/features/proposals/AbTestStat.tsx`,
    `src/features/proposals/AbTestLegendDot.tsx` (or keep inline if cohesive).
  - Smells: §5.1 (threaded `color: 'var(--...)'` props on Stat / LegendDot),
    §13 (inline `style={{ color: TONE_COLOR[tone] }}` — map tone → Tailwind class
    via a `TONE_CLASS` record).

- [ ] **P10.** Split `Login.tsx` (171 lines, 4 components) + use `Button` primitive.
  - Files in scope: `src/features/auth/Login.tsx`, new
    `src/features/auth/OidcLogin.tsx`,
    `src/features/auth/LocalLogin.tsx`,
    `src/features/auth/LegacyClaim.tsx`.
  - Smells: §1 (4 components), use `Button` primitive instead of raw `<button>` with
    bespoke utility classes per DESIGN §3.1.

## Wave schedule

- **Wave 0**: S1 (one agent, serial).
- **Wave 1**: P1, P2, P3, P4, P5, P6, P7, P8, P9, P10 (10 agents, all parallel —
  file sets are fully disjoint across feature folders).
- Each wave ends with `npm run build && npm run lint && npm test` from
  `frontend/`. Re-scan after.
