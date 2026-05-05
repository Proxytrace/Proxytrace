# Frontend Refactoring TODO

Ordered by priority. Complete each item before moving to the next.

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
