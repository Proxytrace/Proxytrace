# Frontend

## Mandatory reading before any frontend code

**Before writing any frontend code, you MUST read BOTH of these — they are mandatory and override any conflicting recommendation from a generic design tool, agent, or external skill:**

1. **[`../frontend/DESIGN.md`](../frontend/DESIGN.md)** — source of truth for the **visual system**: tokens, colors, type scale, spacing, shadows, which UI primitive to render, interaction/accessibility visuals.
2. **[`../frontend/BEST_PRACTICES.md`](../frontend/BEST_PRACTICES.md)** — source of truth for **code architecture**: file/component size limits, feature-folder layout, TanStack Query data layer, `useEffect` discipline, state placement, props/typing, icons, performance, testing.

The split is sharp: DESIGN.md = what it looks like; BEST_PRACTICES.md = how it's built. Both apply to every frontend change. Every PR must satisfy both checklists (DESIGN.md §10 + BEST_PRACTICES.md §14). Do not copy an existing anti-pattern just because a neighbor file does it — large debt files (e.g. `frontend/src/features/evaluators/Evaluators.tsx`) violate BEST_PRACTICES.md and are debt, not precedent.

## UI primitives are mandatory

Every control renders through the `frontend/src/components/ui/` primitives — `Button`/`IconButton`/`RowButton`, `Input`/`Select`/`Textarea`/`Checkbox`/`Radio`/`Switch`/`SegmentedControl`/`Combobox`, and the headless-Radix `Tabs`/`Menu`/`Tooltip`. Raw `<button>`/`<input>`/`<select>`/`<textarea>` outside that layer are blocked by ESLint (`no-restricted-syntax`); for a genuinely bespoke control add a one-line `// eslint-disable-next-line no-restricted-syntax -- <reason>`.

## Architecture

React 19 with Vite, TypeScript, TanStack Query v5, and React Router 7. Code lives in `frontend/`. Layout:

- `src/api/` — typed fetch services (`agents.ts`, `agent-calls.ts`, `providers.ts`, `evaluators.ts`, `proposals.ts`, `setup.ts`, `statistics.ts`, `test-runs.ts`, `test-run-groups.ts`, `test-suites.ts`, `health.ts`), shared `models.ts`, base `client.ts` wrapper, `query-keys.ts` factory, and SSE hooks in `event-stream.ts`
- `src/components/layout/` — top-level chrome (`Shell.tsx`, `NavItem.tsx`)
- `src/components/overlays/` — `Modal.tsx`, `Drawer.tsx`, `ConfirmDialog.tsx`, `StepWizard.tsx`
- `src/components/ui/` — shared primitives: `KpiCard`, `Pill`, `Pagination`, `FilterTabs`, `EmptyState`, `CodeBlock`, `StatusDot`, `ProgressBar`, `Toast`
- `src/features/` — one folder per route: `dashboard`, `traces`, `agents`, `suites`, `evaluators`, `runs`, `providers`, `proposals`, `setup`. Each is a lazy-loaded page component via `React.lazy()` in `App.tsx`
- `src/lib/` — pure utilities: `format.ts` (number/date formatters), `colors.ts` (model/status color maps), `charts.ts` (SVG path math), `constants.ts`
- `src/hooks/` — custom React hooks
- Tailwind CSS 4 via `@tailwindcss/vite`; use Tailwind utility classes for all static styles. Inline `style={{}}` is only acceptable for genuinely dynamic values (e.g. runtime-computed colors, percentage widths from data, a numeric `borderRadius` prop). Complex static values — gradients, shadows, CSS-variable references — must use Tailwind's arbitrary-value syntax: `bg-[linear-gradient(...)]`, `shadow-[var(--shadow-card)]`, `shadow-[0_4px_16px_...]`, etc.
- Tests use Vitest (`*.spec.ts`)

Backend endpoints are proxied through Vite when running `./dev.sh` (`/api` → backend 5001). Frontend runs on port 4201. Real-time updates (new traces, test results, proposals) flow through SSE broadcasters defined in `Proxytrace.Application` and consumed via `event-stream.ts`.

Charts are custom SVG (no chart library): pure geometry helpers live in `src/components/charts/chart-math.ts` (unit-tested) and render-only components alongside them. The Traces page's brushable time-range timeline (`TraceTimeline.tsx` + `computeTimeline`) is backed by `GET /api/agent-calls/histogram`, which returns per-bucket `{ start, total, errors }` for the active filter window. Bucketing happens in the app layer (`AgentCallHistogram.Build`), not in SQL, so it works identically on PostgreSQL and the in-memory test provider — no migration. Drag-selecting on the timeline *zooms* the window (sets an absolute range at higher resolution and filters the table); double-click steps back out.

The time-range filter UI is shared: the `TimeRange` model (`all` / `preset` / `absolute`) lives in `src/lib/timeRange.ts` and the popover control in `src/components/ui/TimeRangePicker.tsx` (`testId` prop for per-page e2e hooks). Both the Error Log and Traces use it. Note the separate, simpler `src/lib/time-range.ts` (`RANGE_KEYS`) used by the dashboard/agents segmented tabs — different concern, don't conflate.

## Commands

- `npm run build` — build the frontend, use this to verify there are no typing issues (output in `dist/`)
- `npm run lint` — run ESLint with auto-fix, use this frequently during development
