# Frontend Refactoring TODO

Ordered by priority. Complete each item before moving to the next.

---

## 7. Create shared form field components

`Evaluators.tsx` and `Providers.tsx` repeat the same input/label/error pattern with local helper functions (`inputStyle()`, `labelStyle()`). There is no shared form component.

**Approach:**
- Add `components/ui/FormField.tsx` wrapping `<label>`, `<input>`/`<textarea>`/`<select>`, and error message
- Replace the helper-function pattern in both files with the new component
- No third-party form library needed at this scale
