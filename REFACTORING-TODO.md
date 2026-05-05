# Frontend Refactoring TODO

Ordered by priority. Complete each item before moving to the next.

---

## 4. Extract `<ColoredBadge>` Component

**Scope:** `frontend-react/src/components/ui/` (new), 6+ feature files
**Priority:** P2

The pattern `style={{ background: \`\${color}1f\`, color, border: \`1px solid \${color}2e\` }}`
appears 25+ times across `PromoteModal`, `TraceDetail`, `Agents`, `Runs`, `Suites`. It is
mechanically identical each time but has no shared home.

**Approach:**
- Create `src/components/ui/ColoredBadge.tsx` accepting `color` and `label` props
- Replace all 25+ inline occurrences

---

## 5. Extract `<Avatar>` Component

**Scope:** `frontend-react/src/components/ui/` (new), `Shell.tsx`, `Agents.tsx`, `Providers.tsx`
**Priority:** P2

A gradient circle with initials appears 15+ times:
`style={{ background: \`linear-gradient(135deg, \${color}cc, \${color}88)\` }}`.
No shared component exists.

**Approach:**
- Create `src/components/ui/Avatar.tsx` accepting `initials`, `color`, optional `size`
- Replace all occurrences in Shell, Agents, and Providers

---

## 6. Standardize EmptyState Usage

**Scope:** `frontend-react/src/components/ui/EmptyState.tsx` (exists), 6 feature files
**Priority:** P2

`EmptyState` component exists but is only used in `Dashboard.tsx`. Six other features render
ad-hoc centered `<div>` text for empty lists (Agents, Providers ×3, Runs, Suites). New features
copy whichever pattern they see first.

**Approach:**
- Replace all manual empty-state `<div>` text with `<EmptyState title="..." description="..." />`
  in `Agents.tsx`, `Providers.tsx`, `Runs.tsx`, `Suites.tsx`, `Traces.tsx`

---

## 7. Extract `<ModalFooter>` Component

**Scope:** `frontend-react/src/components/overlays/Modal.tsx`, 8+ modal usages
**Priority:** P2

Every modal has the same Cancel + Submit button footer with identical class names
(`btn-ghost` / `btn-primary`), disabled logic, and loading label pattern. Duplicated in
Evaluators (×3), Providers, Suites (×3), and two custom modals.

**Approach:**
- Add a `<ModalFooter>` export to `src/components/overlays/Modal.tsx` accepting `onCancel`,
  `onSubmit`, `submitLabel`, `loading`, `disabled`
- Replace all 8+ footer blocks

---

## 8. Remove Inline Sparkline in Suites.tsx

**Scope:** `frontend-react/src/features/suites/Suites.tsx` lines 20–28
**Priority:** P2

`Suites.tsx` defines a local `Sparkline` component that reimplements sparkline path math already
in `src/lib/charts.ts` (`sparklinePath`). This keeps two implementations in sync.

**Approach:**
- Delete the inline `Sparkline` component in `Suites.tsx`
- Replace with `sparklinePath()` from `src/lib/charts.ts` (same approach used in `KpiCard`)

---

## 9. Extract `useFilter` Hook

**Scope:** `frontend-react/src/features/` (Evaluators, Providers, Runs, Suites, Traces)
**Priority:** P3

Five features implement identical `useState` + derived-array filter boilerplate. Any change to
filter behavior (URL sync, debouncing) must be replicated in five places.

**Approach:**
- Create `src/hooks/useFilter.ts` accepting items + filter options, returning filtered items
  and filter state setters
- Replace boilerplate in each feature

---

## 10. Extract `<FilterChip>` Component

**Scope:** `frontend-react/src/features/traces/Traces.tsx` lines 18–28 → `src/components/ui/`
**Priority:** P3

`FilterChip` is a useful inline component in `Traces.tsx` that renders a styled clickable chip
for agent/range/model filtering. It is duplicated conceptually with parts of `FilterTabs` but
more flexible. Keeping it inline prevents reuse in other features.

**Approach:**
- Move `FilterChip` to `src/components/ui/FilterChip.tsx`
- Update `Traces.tsx` to import from the shared location

---

## 11. Centralize Magic-Number Constants

**Scope:** `frontend-react/src/features/` (Dashboard, Runs, Suites, Traces)
**Priority:** P3

Pass-rate thresholds (`75`, `55`), score thresholds (`0.8`, `0.5`), refetch intervals
(`30_000`, `60_000`, `15_000`), and page sizes (`200`, `100`, `20`) are hardcoded in 5+
feature files. Changing a threshold requires hunting across the codebase.

**Approach:**
- Create `src/lib/constants.ts` with named exports: `PASS_RATE_WARN`, `PASS_RATE_DANGER`,
  `REFETCH_INTERVAL_SLOW`, `REFETCH_INTERVAL_FAST`, `DEFAULT_PAGE_SIZE`
- Replace all hardcoded occurrences

---

## 12. Migrate High-Frequency Inline Styles to Tailwind

**Scope:** `frontend-react/src/features/` and `src/components/` (all files)
**Priority:** P3

416 `style={{}}` instances exist. The highest-frequency patterns (`display: flex`,
`overflow: hidden`, `white-space: nowrap`, `transition: 'all 0.12s'`) have direct Tailwind
equivalents and account for ~80 occurrences. CSS-variable-backed styles require a different
approach but the purely structural ones can be removed immediately.

**Approach:**
- Migrate structural inline styles (`display`, `overflow`, `white-space`, `transition`,
  `cursor`, `align-items`, `justify-content`) to Tailwind class equivalents
- Leave dynamic color/gradient `style={{}}` for a follow-up migration tied to CSS custom properties

---

## 13. Extract `<Collapsible>` Component

**Scope:** `frontend-react/src/features/agents/Agents.tsx`, `TraceDetail.tsx`, `Runs.tsx`
**Priority:** P3

Expand/collapse toggle patterns with rotation chevrons appear 5+ times inline. Each feature
manages its own `expanded` state set and conditional rendering.

**Approach:**
- Create `src/components/ui/Collapsible.tsx` accepting `title`, `defaultOpen`, and `children`
- Replace inline expand/collapse patterns in Agents, TraceDetail, and Runs

---

## 14. Standardize Pagination Approach

**Scope:** `frontend-react/src/features/` (all except Traces)
**Priority:** P4

Only `Traces.tsx` uses the `<Pagination>` component with a real `pageSize=20`. All other
features request `pageSize=200` (or `100`) to fake "load all" behavior. This is inconsistent
and will not scale.

**Approach:**
- Decide project-wide: either add server-side pagination to all list endpoints and use
  `<Pagination>` consistently, or document that `pageSize=200` is intentional for now
- If adding pagination: extend the API layer and add `<Pagination>` to Agents, Evaluators,
  Suites, Runs, Providers
