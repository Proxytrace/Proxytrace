# Frontend Refactoring TODO

Ordered by priority. Complete each item before moving to the next.

---

## 2. Delete the stale `frontend-react/` directory

`frontend-react/` contains only a `.vite` cache folder and is referenced incorrectly by `dev.sh`. Once CLAUDE.md and `dev.sh` are updated, remove it.

---

## 3. Migrate inline styles to Tailwind

Every component uses `style={{...}}` inline objects referencing CSS custom properties (`--bg-primary`, `--text-secondary`, etc.). Tailwind 4 is already configured but unused in components.

**Approach:**
- Audit `index.css` for the CSS variable definitions and map them to Tailwind theme tokens
- Work through components file by file, replacing inline style objects with Tailwind classes
- Priority order: shared UI components first (`components/ui/`, `components/layout/`), then features
- Keep CSS variables as Tailwind theme tokens (not hard-coded hex values) so the design system remains in one place

---

## 4. Centralize SVG icons

Icons are copy-pasted inline across `Shell.tsx`, `TraceDetail.tsx`, `EmptyState.tsx`, and others. Each usage redefines the same SVG paths.

**Approach:**
- Create `components/icons/index.tsx` exporting named icon components (`<ChevronRight />`, `<CloseIcon />`, etc.)
- Audit all feature and layout files for inline SVG definitions and replace with imports

---

## 5. Extract inline modal/form components

Several large feature files define sub-components inline that belong in their own files:

- `TraceDetail.tsx` → `PromoteModal` (~150 lines, complex 2-panel layout)
- `Suites.tsx` → `RunConfirmModal` (~50 lines)
- `Evaluators.tsx` → `EvaluatorForm` (branching form by kind)

**Approach:**
- Move each to a co-located file (e.g., `features/traces/PromoteModal.tsx`)
- No API changes needed — just file splits

---

## 6. Wire Dashboard to real API data

`Dashboard.tsx` uses hardcoded static arrays for every chart and table. The API services exist (`statistics.ts`, `agents.ts`, `agent-calls.ts`) but are not called from the dashboard.

**Approach:**
- Replace static arrays with `useQuery` calls to the relevant services
- Chart math (sparklines, histograms, area paths) can stay in `lib/charts.ts` — just feed it real data
- Handle loading and empty states using the existing `EmptyState` component

---

## 7. Create shared form field components

`Evaluators.tsx` and `Providers.tsx` repeat the same input/label/error pattern with local helper functions (`inputStyle()`, `labelStyle()`). There is no shared form component.

**Approach:**
- Add `components/ui/FormField.tsx` wrapping `<label>`, `<input>`/`<textarea>`/`<select>`, and error message
- Replace the helper-function pattern in both files with the new component
- No third-party form library needed at this scale
