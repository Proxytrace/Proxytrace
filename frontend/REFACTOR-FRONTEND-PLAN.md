# Frontend Refactor Plan

Durable, resumable backlog for driving `frontend/` to conform to
`BEST_PRACTICES.md` + `DESIGN.md`. Work top-to-bottom. After **every** item:
`npm run build && npm run lint && npm test` must be green (run from `frontend/`).
Do not commit. Behavior + appearance preserved — restructure only.

Legend for scan columns: `LINES CMP STY QRY SVG EFF ANY !`.

## Baseline (2026-05-24)

- [x] **P0 — Fix `Evaluators.tsx` / `evaluators.ts` casing collision.** On
  case-insensitive macOS FS `import('./features/evaluators/Evaluators')`
  ambiguously matched both files → `tsc` TS1261/TS1149, red local build.
  Renamed constants module `evaluators.ts` → `evaluatorMeta.ts`, updated 2
  importers (`Evaluators.tsx`, `EvaluatorForm.tsx`). Build/lint/test green.
  **Deviation note:** BEST_PRACTICES §2 names the feature constants file
  `<feature>.ts`; on a case-insensitive FS that collides with the
  `<Feature>.tsx` page, so this feature uses `evaluatorMeta.ts` instead.

Initial scan totals: 1 file >1000 lines, ~12 files >300 lines, ~50 non-null
`!`, ~0 `any`, many inline `style={{}}`, ~19 inline `<svg>`.

---

## P1 — Forbidden constructs / correctness

Verify each `!` is a genuine non-null assertion before narrowing (scanner can be
noisy). Fix the type/flow; never re-suppress.

- [x] **P1.1 — `Badge.tsx` (5×`!`).** Restructured to a single always-defined
  `palette` (tint vs variant token); removed all 5 `!` AND fixed a latent crash
  (tinted variant without `color` now falls back to neutral). Green, 0 `!`.
- [x] **P1.2 — `CodeBlock.tsx` (2×`!`).** No-op: the 2 hits are the string
  literal `'Copied!'`, not non-null assertions. Scanner `!` column counts boolean
  negation + string `!` too — verify in context before acting on `!` counts.
- [x] **P1.3 — `Providers.tsx` non-null sweep (15×`!`).** Done as part of P2.4:
  query/mutation hooks now take a guaranteed `providerId` and `ModelsTab`/`KeysTab`
  are self-contained, so all 15 `!` are gone. 0 non-null in the feature.
- [x] **P1.4 — `ProjectsTab.tsx` (7×`!`).** Done with P2.10: hooks thread ids;
  endpoint-label helper replaced the `find(...)!` chain. 0 `!`.
- [x] **P1.5 — `SearchIndexingTab.tsx` (6×`!`).** Done with P2.11: hooks take a
  guaranteed `projectId`; mutate sites pass `selectedProject.id`. 0 `!`.
- [x] **P1.6 — `EvaluatorTestBench.tsx` (3×`!`).** Narrowed: `testCaseId ?? ''` behind enabled guards; `result.reasoning &&` replaces the `hasReasoning`+`!`. 0 `!`.
- [x] **P1.7 — `Suites.tsx` (3×`!`).** Narrowed: `passRate ?? 0` in the avg reduce; `startRun`/`delSuite` mutations thread the suite id. 0 `!`.
- [x] **P1.8 — `TraceDetail.tsx` (4×`!`).** No-op: all 4 were string/false positives — no real non-null assertions.
- [x] **P1.9 — small `!` cleanups.** `AbTestHero` (guard `deltaPts != null`),
  `Agents` (thread id through delete mutation), `Traces` (`?? []`), plus
  `main.tsx` (root-element guard) and `Settings.tsx` (`?? TABS[0]`). `Invites`
  flag was a string false-positive. All green, no real `!` left in these.
- [x] **P1.10 — `useEffect` audit.** Done across all splits. Dashboard(2)→useLiveClock/useFreshTraces; Traces(3)→useFocusTrace/useScrollToTrace/useTraceSseStream; Playground(5)→playground hooks; EditSuiteDialog(1)→useEscapeKey; UnifiedSearch(2)→useSearchInteraction. App.tsx(3) left in place — all 3 are genuine external syncs (auth-token module sync, global 401 handler w/ cleanup, document.body class) per §4.1.
- [x] **P1.11 — `<div onClick>` sweep.** No forbidden action-`div`s: all matches
  are overlay backdrops (dismiss-on-click, paired with Esc) or `stopPropagation`
  wrappers. The two `role="button"` spans (`EvaluatorTestBench`, `ToolMessageBubble`)
  are fully accessible (tabIndex + keyboard/focus handlers). `RunConfirmModal`
  hand-rolls an overlay instead of reusing `Modal` → tracked in P3.1.
  Server-data-in-`useState` is handled per-file in the P1.10 effect audit / splits.

---

## P2 — Structural: split >300-line files, extract data hooks

Each page keeps orchestration only; subcomponents move to `components/`, data to
`hooks/`, constants/maps to a feature `.ts`. Query keys come from `QUERY_KEYS`;
new endpoints get a typed fn in `api/<service>.ts` first.

### P2.1 — Evaluators.tsx — the monster — DONE [opus subagent]
- [x] **P2.1 (a–f) — Evaluators.tsx 1433 → 192.** Extended `evaluatorMeta.ts`
  (+spec, 14 tests) and added `categoryClasses.ts`; `hooks/useEvaluatorQueries.ts`
  + `useEvaluatorMutations.ts` (all 9 queries, all 6 `!` removed); ~21 components
  under `components/`. 185 inline styles → Tailwind; semantic `category` prop
  instead of threaded colors. 11 inline `<svg>` → icon module (orchestrator
  promoted FlaskIcon/FilterIcon/HashIcon/PlayFilledIcon/EditPencilIcon/
  SearchLineIcon/TestBenchChevronIcon/TestBenchPlayIcon). Thin orchestrator, 1 cmp.
- [x] **P2.2 — Setup.tsx (599 → 21).** Split into `setupMeta.ts`, `hooks/useSetupWizard.ts`+`useModelLoader.ts`, and `components/{SetupWizard,FirstAdminStep,ProviderStep,ModelStep,ProjectStep,ApiKeyStep}.tsx`. 3 inline svg → `ChevronDownIcon`/`CheckIcon`. Setup.spec.ts still green. All files <300.
- [x] **P2.3 — Dashboard.tsx (592 → 150).** Extracted `dashboardMeta.ts` (+spec, 20 tests), `hooks/useDashboardQueries.ts` (all 10 queries) + `useLiveClock`/`useFreshTraces` (the 2 effects, now genuine external-system hooks), and 11 presentational components. Static styles → Tailwind; runtime colors kept inline. All files <300.
- [x] **P2.4 — Providers.tsx (556 → 80).** Extracted `providerMeta.ts` (+spec, 5
  tests), `hooks/useProviderQueries.ts` + `hooks/useProviderMutations.ts`, and
  `components/{ProviderList,ProviderDetail,ProviderDetailHeader,ModelsTab,KeysTab,
  AddProviderModal}.tsx`. Page is orchestration only; all files <300; grid
  `style={{}}` → Tailwind `grid-cols-[...]`; 0 raw queries in page; 0 `!`.
  Behavior preserved (keyed remount reproduces `selectProvider` resets; both tabs
  stay mounted so form state survives tab switches as before).
- [x] **P2.5 — Traces.tsx (555 → 160).** [subagent] Extracted `tracesMeta.ts` (buildRows/rangeFrom/latencyBarPct + 17 tests), `hooks/{useTraceQueries,useFocusTrace,useScrollToTrace,useTraceSseStream,useDebounce}.ts`, and ~12 components. svg→`MiniChevronIcon` (added to icon module by orchestrator). 3 effects resolved into external-system hooks. NOTE: SSE still uses invalidate (not setQueryData) — preserved original; the TraceCreated event lacks full data to patch the cache (backend limitation). All files <300.
- [x] **P2.6 — EvaluatorTestBench.tsx (396 → 241).** [opus subagent] 8 cmp → 1; ResultPill/ReasoningTip/ResponsePane/EmptyBench/ErrorState extracted; svg→icon module; styles→Tailwind; `!` already gone (P1.6). Also EvaluatorStatsBlock.tsx 205 → 41 (raw query→hook, 20 styles→Tailwind). NOTE: EvaluatorStatsBlock has no importers — dead code, recommend deletion.
- [x] **P2.7 — Suites.tsx (390 → 263).** [subagent] Extracted `hooks/useSuiteQueries.ts`+`useSuiteMutations.ts`, `suitesMeta.ts` (+8 tests), `components/SuiteCard.tsx` (44 styles→Tailwind). Inline `['test-suites']` keys → `QUERY_KEYS.testSuites()`. Orchestrator fixed: restored `projectId` passthrough + removed agent-added `enabled` guards to preserve exact behavior. Remaining svg is a data-driven sparkline (not an icon).
- [x] **P2.8 — ProposalDetail.tsx (493 → 77).** Extracted `proposalsMeta.ts` (`buildPromptDiff`+spec, 6 tests; renamed from `proposals.ts` to avoid the macOS `Proposals.tsx` casing collision), `hooks/useUpdateProposalStatus.ts`, and `components/{ProposalHeader,PredictedImpactBand,PromptDiff,ModelSwitchSection,ToolUpdateSection,EvidenceList,ProposalActionBar,ProposalTerminalNote}.tsx`. Static styles→Tailwind; runtime tone colors inline.
- [x] **P2.9 — Playground.tsx (462 → 269) + RightRail.tsx (374 → 191).** [subagent] `playgroundMeta.ts`(+9 tests), `hooks/{usePlaygroundAgent,usePlaygroundStream,useSeedDropdown}.ts`, RightRailDrawer extracted. All 5 effects confirmed genuine external syncs, moved into hooks. Inline `['agent',id]` key → new `QUERY_KEYS.agent`; ResetIcon → icon module. svg/styles cleaned. Bug found (preserved): `toolsModified()` in RightRail always returns false — see B3.
- [x] **P2.10 — ProjectsTab.tsx (362 → 299).** Extracted `projectsMeta.ts`
  (`initials`/`colorFor`/`endpointLabel` + spec, 6 tests) and `hooks/useProjects.ts`
  (5 queries + 5 mutations, ids threaded). Page is orchestration only; 0 raw
  queries; 0 `!`. Behavior preserved.
- [x] **P2.11 — SearchIndexingTab.tsx (357 → 267).** Extracted
  `hooks/useSearchIndexing.ts` (settings/status queries + update/reindex mutations),
  reused `hooks/useProjects.useProjects`, and moved `StatusCell`/`ToggleRow` to
  `components/`. 1 component/file; 0 raw queries; 0 `!`. Behavior preserved
  (draft init left as-is — see B2).
- [x] **P2.12 — TraceDetail.tsx (418 → 3-line re-export).** [subagent] Split into `components/TraceDetailPanel.tsx` (248) + TraceMessagesTab/TraceMetadataTab/DrawerStat/ToolResultBlock. styles→Tailwind. (Panel keeps 1 small drawer-scoped useQuery — acceptable.)
- [x] **P2.13 — UnifiedSearch.tsx (344 → 216) + SearchPreview.tsx (322 → 58).** [subagent] Extracted `searchMeta.ts`(+11 tests), `searchGrouping.ts`, `hooks/{useSearchQuery,useSearchPreviewQuery,useSearchInteraction}.ts`, and split SearchPreview into 12+ component files. 2 effects (debounce+click-outside) → hook. Exported API unchanged. NOTE: a few static `var(--success-subtle)` inline styles in *Preview bodies left verbatim — flagged for P3 polish.
- [x] **P2.14 — EditSuiteDialog.tsx (315 → 194).** [subagent] Extracted `hooks/useEditSuiteQueries.ts`+`useSaveSuite.ts`+`useEscapeKey.ts`, and EditSuiteHeader/Footer/DirtyIndicator/DiscardConfirm components. Esc effect → hook.

---

## P3 — Mechanics (inline svg, static styles, query keys, threaded colors)

For files NOT already covered by a P2 split:
- [x] **P3.1 — RunConfirmModal.tsx.** Done in P2.7: now uses shared `Modal`/`ModalFooter`; static styles → Tailwind.
- [x] **P3.2 — EvaluatorStatsBlock.tsx.** Done in P2.6 (205 → 41, 20 styles → Tailwind).
- [x] **P3.3 — AbTestHero.tsx.** `!` fixed in P1.9; 3 static progress-bar bg styles → Tailwind. Remaining inline styles are runtime TONE colors (legit). 159 lines, two <10-line private render helpers (acceptable).
- [x] **P3.4 — RightRail.tsx.** Done in P2.9 (374 → 191, svg→ResetIcon, styles→Tailwind). PromoteModal/Invites residue tracked in "Remaining polish" below.
- [x] **P3.5 — components/icons/index.tsx (430, 48 cmp).** DOCUMENTED EXCEPTION (§6 sanctioned single icon module). Grew as the orchestrator promoted ~12 icons out of feature files. The flagged "inline svg" are the standalone Mini/Grip/TestBench glyphs that need a custom viewBox/fill — legit. Not split.

(P4 polish items consolidated into "Remaining polish" below.)

---

## Bugs found — NOW FIXED (deliberate behavior changes, on user request)

- **B1 — `ProjectsTab` edit drafts never initialize.** `nameDraft`/`endpointDraft`
  are `useState(selected?.name ?? '')` — set once at mount before `selected` has
  loaded, and never synced after. First time you click "edit name"/"edit endpoint"
  the field shows an empty/stale value (until Cancel, which resets it correctly).
  **FIXED:** the "edit name"/"edit endpoint" buttons now seed the draft from
  `selected` when entering edit mode.
- **B2 — `SearchIndexingTab` settings form never populates.** `draft` is
  `useState(settings ?? null)` — set once at mount before the settings query
  resolves and never synced, so `draft` stays `null` and the entire settings
  form (gated on `draft ?`) appears not to render. Same server-data-in-`useState`
  anti-pattern as B1. **FIXED:** `draft` now derives-on-change from `settings`
  (re-seeds whenever the loaded settings object changes identity — initial load,
  project switch, post-save), via a set-during-render guard (no effect).
- **B3 — `RightRail.toolsModified()` always returns false.** Compares
  `current.length !== defaultLength` but is passed `overrides.tools.length` as
  `defaultLength`, so it can never differ. **FIXED:** RightRail now takes a
  `defaultToolCount` prop (the agent's `tools.length`) and compares against it.

## Polish — DONE

- [x] **P3 — static inline `style={{}}` in leaf/shared components.**
  `ToolMessageBubble` (16 converted, 3 runtime kept), `Card` (both runtime),
  `traces/PromoteModal` (7 converted), `TraceDetailPanel` (2), search
  `AgentPreview`/`TestSuitePreview` token chips → Tailwind. All remaining inline
  styles verified runtime (lib/colors hex, data-driven %/px, runtime color-mix).
- [x] **P3 — inline `<svg>` in shared primitives.** `Select`→ChevronDownIcon,
  `Toast`→XIcon, `StepWizard`→CheckIcon, `ProjectSelector`→ChevronUpIcon/CheckIcon
  (added `ChevronUpIcon` to the icon module). Only remaining feature `<svg>` is
  `SuiteCard`'s data-driven sparkline (legit, not an icon).
- [x] **P3 — `admin/Invites.tsx` (158 → 130).** New `api/invites.ts` service +
  `QUERY_KEYS.invites` + `features/admin/hooks/useInvites.ts`; page now has 0 raw
  queries.
- [x] **P4 — dead code:** deleted `features/evaluators/EvaluatorStatsBlock.tsx`
  (no importers; its sub-components stay, used by `EvaluatorDetail`).
- [x] **P4 — redundant `useMemo`/`useCallback` sweep.** DONE (Wave F1, 5 parallel
  agents, disjoint sets). Audited all 155 sites / 42 files. Removed ~65 that
  provably guarded nothing (cheap derivations consumed only by non-memoized JSX,
  not in any dep array): totals `useMemo` 103→54, `useCallback` 52→36. KEPT all
  load-bearing memoization with documented reasons — context `value` memos
  (ProjectProvider, LocalAuthProvider), chart SVG-path/scale math (all 6 charts +
  StatsBlockBody/PerformancePanel consumers were the *callers*, not the math),
  SSE/effect-dep callbacks (event-stream, useTraceSseStream, GroupDetail, setup
  hooks, useFreshTraces), and hook public APIs (usePlaygroundStream/Session,
  searchGrouping, useSearchQuery, useEvaluatorQueries). `npm run build && lint &&
  test` green. Key insight that justified several removals: `useEventStream`
  routes handlers through a ref, so callback identity never re-subscribes a stream.

### Wave F1 — memoization sweep (parallel, disjoint sets)
- Agent A: `features/agents/*` + `features/dashboard/*`
- Agent B: `features/traces/*` + `features/proposals/*`
- Agent C: `features/playground/*` + `features/evaluators/*` + `features/evaluator-playground/*`
- Agent D: `features/runs/*` + `features/suites/*` + `features/setup/*` + `features/settings/*`
- Agent E: shared — `components/*` (charts/ui/layout/search) + `contexts/*` + `auth/*` + `api/*`

## Re-evaluation pass (2026-05-24) — scanner-blind smells the first pass missed

Found by reading files (not scanner). All fixed; build+lint+test green.

- [x] **RE.1 — `Agents.tsx` raw `useQuery`+`useMutation` in page.** Extracted
  `features/agents/hooks/useAgents.ts` (`useAgents` + `useDeleteAgent(onSuccess)`).
  Page is orchestration only now; delete-then-select logic stays in the page via
  the hook's `onSuccess(id)` callback. §3.1/§14.
- [x] **RE.2 — `Proposals.tsx` raw `useQuery` in page.** Extracted
  `features/proposals/hooks/useProposals.ts`. (P2.8 had only done ProposalDetail.)
- [x] **RE.3 — `SuiteCard.tsx` imperative hover + emoji icon.** Replaced
  `onMouseEnter/Leave` DOM `style.boxShadow` mutation with a runtime `--suite-accent`
  CSS var + Tailwind `hover:shadow-[…var(--suite-accent)…]`. Replaced `▶`
  emoji-as-icon with `PlayFilledIcon` (DESIGN §5). Same fix to `RunForm.tsx` `▶`.
- [x] **RE.4 — `ProjectsTab`/`SearchIndexingTab` duplicated selection logic.**
  Extracted shared `features/settings/hooks/useProjectSelection.ts` (search filter +
  sticky-with-fallback effectiveId). Both tabs consume it. §3 cross-file dup.
- [x] **RE.5 — `NameStep.tsx` static `style={{}}` gated on boolean.** Preset/custom
  chip buttons → `cn()` + Tailwind (`border-accent bg-accent-subtle text-accent-hover`
  active recipe, matching TracesStep). §7.

- [x] **RE.6 — `EvaluatorPlayground.tsx` raw `useQuery` in route page.** Extracted
  `features/evaluator-playground/hooks/useEvaluatorList.ts` (list + name sort).
  Page is orchestration only now; dropped the redundant `useMemo` (sort lives in
  the hook). §3.1/§14.

### Tracked follow-ups — DONE

- [x] **RE.F1 — `EvaluatorTestBench.tsx` 3 raw queries extracted.** All data +
  derived state (`defaultData → autoHit → testCaseId → payloadQuery → runMutation`,
  plus pick/override/lastResult state and the evaluatorId-change reset) moved into
  `hooks/useEvaluatorTestBench.ts` (112 lines). Component is presentational now
  (237 → 161): keeps only `rootRef`/`useImperativeHandle` for focus + JSX. §3.1.
- [x] **RE.F2 — Cross-feature import resolved (§13).** Discovery: the bench cluster
  (`EvaluatorTestBench`, `TestResultPicker`, `TestBenchPanes`, `TestBenchResult`)
  was imported by **only** `EvaluatorPlayground` — the evaluators feature never used
  it. So it didn't need promoting to `components/`; it was simply mis-filed.
  `git mv`'d the whole cluster into `features/evaluator-playground/` (+`components/`),
  fixed import depths, repointed the page to `./EvaluatorTestBench`. Zero
  cross-feature imports remain in `features/` (verified by grep).

Noted, left as-is (out of scope / acceptable): `Signup` invite-preview single
scoped `useQuery` (1 query, form-local — same tolerance as drawer/modal scoped
queries); `RunForm` submit-button static
styles gated on `hasSelection`/`loading` (minor §7, same shape as several buttons —
candidate for a future `classes.ts` button recipe); set-state-during-render prev-id
resets (React-endorsed derive, §4.1 alternative to `key`); index keys on
append/rebuild lists; `ModelSwitchSection` color/tint props (data-driven runtime).

## Documented exceptions (not violations)

- `App.tsx` (218) — root router/composition; 7 tiny route-guard wrapper
  components + 3 genuine external effects + 2 root queries. Under the 300 hard
  limit; acceptable as the composition root.

- `components/icons/index.tsx` — sanctioned icon module (§6); many tiny cmp + 1
  wrapper `<svg>` are by design.
- `api/models.ts` (609) — pure DTO type declarations, no logic; type files are
  exempt from the component size limit.
- `features/evaluators/evaluatorMeta.ts` naming — see P0 note.

- `features/traces/components/TraceTableCells.tsx` (58) — 5 component fns flagged
  by the scanner, but each is a <20-line stateless presentational *cell* renderer
  (LatencyBar/TraceIdCell/TokenCell/ToolsCell/LatencyCell) shared by both
  `FlatTraceRow` and `ConversationGroupRow`. Cohesive cluster of tiny shared
  leaves; splitting into 5 one-cell files would hurt readability, not help it. Its
  2 inline `style={{}}` are runtime-computed (data-driven width %, runtime
  agent/model hex) — legit per §7. Kept as one file.

- The high-`QRY` hook files (`useDashboardQueries`, `useProjects`,
  `useProviderMutations`, `useEvaluatorQueries`, …) — these ARE the §3.1 extracted
  query-hook layer; many `useQuery`/`useMutation` in one such hook module is the
  *target* state, not a smell. Scanner `QRY` column flags them as false positives.

- `components/ui/CodeBlock.tsx` `!` count — the `'Copied!'` string literal, not a
  non-null assertion (see P1.2). Scanner false positive.
