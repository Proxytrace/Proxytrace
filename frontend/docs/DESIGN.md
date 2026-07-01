# Proxytrace UI Design Guide

**Required reading before any frontend work.** This document is the source of truth for visual style, component conventions, and interaction patterns. Skim if you've read it before; obey it always. The codebase already implements these rules — your job is to extend the system, not invent a parallel one.

If a rule here conflicts with a generic design recommendation (from a tool, agent, or external skill), this guide wins.

---

## 1. Product context

Proxytrace is an AI-agent observability + benchmarking platform. The user is a developer or ML engineer staring at traces, test runs, evaluations, and proposals — often for long stretches. That dictates everything below:

- **Information density over whitespace luxury.** Body text is 12px, not 16px. Cards stack tightly. Whitespace earns its place.
- **Calm, not flashy.** Dark surface, single warm accent. No rainbows, no glassmorphism flourishes, no animated gradients on idle UI.
- **Code-adjacent feel.** Mono font for IDs, payloads, model names, JSON. Inter for prose.
- **Trust signals matter.** Status colors must be unambiguous. Number formatting must be consistent. Streaming/live state must be visible without being noisy.

Anti-personas: marketing landing page, e-commerce product, consumer app. Do not import patterns from those domains.

---

## 2. Theme system — design tokens

All tokens are declared in `frontend/src/index.css` and exposed to Tailwind 4 via `@theme`. **Never hardcode hex values, pixel sizes, or shadow strings in components.** Reference tokens through Tailwind utilities (`bg-card`, `text-secondary`, `rounded-lg`, `text-body-sm`) or arbitrary-value syntax against the CSS variable (`shadow-[var(--shadow-card)]`, `bg-[image:var(--grad-accent)]`).

### 2.1 Colors

Dark-only — a deep ink base (subtle blue cast) with a single warm-amber accent.

| Role | Token | Hex | Use |
|------|-------|-----|-----|
| Page background | `bg-surface` | `#121317` | Body / app shell |
| Elevated surface | `bg-surface-2` | `#17181d` | Modals, drawers, top bar |
| Sidebar | `bg-sidebar` | `#15161b` | Left nav |
| Card | `bg-card` | `#1c1d24` | Default card |
| Card raised | `bg-card-2` | `#26272f` | Nested card / hovered list row |
| Border | `border-border` | rgba(255,255,255,0.08) | Default border |
| Border subtle | `border-border-subtle` | rgba(255,255,255,0.05) | Row dividers |
| Hairline | `border-hairline` | rgba(255,255,255,0.06) | Internal card splits |
| Text primary | `text-primary` | `#edeef2` | Headings, key values |
| Text secondary | `text-secondary` | `#9da1ac` | Labels, body prose |
| Text muted | `text-muted` | `#686d7a` | Captions, placeholders |
| Accent | `text-accent`, `bg-accent` | `#d9a158` | Primary CTAs, active nav, focus ring |
| Accent hover | `accent-hover` | `#ecbf83` | Hover only |
| Accent ink | `text-accent-ink` | `#251a04` | Dark text/icon **on** a gold fill (primary button) — AA on accent |
| Accent text | `text-accent-text` | `#f0cd92` | Gold text on dark (active filter chip / status pill) |
| Accent press | `var(--accent-press)` | `#c68f46` | Pressed/active gold fill |
| Accent border | `var(--accent-border)` | rgba(217,161,88,0.45) | Gold hairline (active chip / status) |
| Success | `text-success`, `bg-success` | `#46b97c` | Pass, healthy, run-green |
| Warn | `text-warn` | `#dd9a64` | Throttle, slow, 4xx |
| Danger | `text-danger` | `#e25d5d` | Fail, error, destructive |
| Teal | `text-teal` | `#74a8b6` | Rule-based evaluators, info chips |

The page background carries a fixed, very-low-opacity atmosphere (gold aurora top, teal corner glow) plus a 2% film-grain overlay — both defined once in `index.css` on `body::before`/`body::after`. Don't add per-page background effects.

**Subtle semantic backgrounds** (`bg-success-subtle`, `bg-warn-subtle`, `bg-danger-subtle`, `bg-accent-subtle`) — use these for status pills and tinted surfaces. Never put white text on a subtle background; pair the subtle bg with the matching solid text color.

**Dynamic colors** (per-model, per-agent, per-evaluator) come from `frontend/src/lib/colors.ts`: `modelColor(name)`, `agentColor(id)`, `EVALUATOR_KIND_COLOR`, `statusColor(httpStatus)`. Hash-based assignment is stable — do not invent new palettes for new entity types; extend the existing helpers.

**Never** introduce new brand hexes. If you think you need one, you don't — combine accent + a semantic + opacity.

### 2.2 Typography

- **Body:** Inter, with feature-settings `cv11 ss01 ss03` (defined globally on `body`).
- **Mono:** JetBrains Mono (fallback Fira Code) — apply via `.mono` class or Tailwind `font-mono`. Use for IDs, model names, token counts, JSON, code, kbd hints.
- Both faces are **bundled** via `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono` (imported in `main.tsx`; family names `'Inter Variable'` / `'JetBrains Mono Variable'`). Never add a Google Fonts `<link>` — CSP allows `font-src 'self'` only.
- **Heading font ≠ body font** is *not* our pattern. We use Inter for everything; rhythm comes from the type scale, not face contrast.

Type scale (data-dense — do not enlarge without a strong reason):

| Token | Size | Use |
|-------|------|-----|
| `text-caption` | 10px | Tiny eyebrow labels, kbd, axis ticks |
| `text-body-sm` | 11px | Pills, chips, secondary labels, metadata |
| `text-body` | 12px | Default body, table cells, descriptions |
| `text-title` | 13px | Card section labels, button labels, nav items |
| `text-h2` | 14px | Card titles |
| `text-h1` | 18px | Page titles, drawer headers |
| `text-display` | 28px | KPI numbers only |

Weights: 400 (default), 500 (nav, secondary buttons), 600 (titles, primary buttons, KPI), 700 (rare — model pills already at 600). Never use 800/900.

Line height: default; never override globally. For multi-line prose blocks (rare), `leading-relaxed`.

### 2.3 Radii

Collapsed scale — there are exactly four:

| Token | Px | Use |
|-------|----|-----|
| `rounded-sm` | 6 | Inputs, chips, small buttons (sm) |
| `rounded-md` | 10 | Buttons, default control radius |
| `rounded-lg` | 14 | Cards |
| `rounded-xl` | 18 | Modals, drawers, large floating panels |

Pills are `rounded-full`. Status dots are `rounded-full`. **Don't use Tailwind's default `rounded-2xl`/`rounded-3xl`** — they don't exist in our scale.

### 2.4 Spacing

Use Tailwind's spacing scale (`p-2`, `gap-3`, etc.). Card internal padding defaults: `p-4` (Card md). Tight rows: `py-2`. Section gaps: `gap-4` to `gap-6`. Page container max width via `max-w-6xl` or `max-w-7xl` — pick one per route and stay consistent.

For runtime-computed values only, `var(--space-N)` exists (4/8/12/16/20/24/32/48). Do not use it as a substitute for Tailwind utilities on static layouts.

### 2.5 Shadows / elevation

Three tiers — do not invent ad-hoc shadows.

| Token | Use |
|-------|-----|
| `shadow-[var(--shadow-card)]` | Default card |
| `shadow-[var(--shadow-float)]` | Modal, drawer, dropdown, popover |
| `shadow-[var(--shadow-pill)]` | Pills, chips, kbd |

Each elevation shadow already includes a 1px `rgba(255,255,255,…)` edge ring — that's what crisps surfaces against the ink background. Don't stack an extra `border` on a raised/floating surface that uses these tokens.

Buttons have their own shadows baked into the variant (`--shadow-btn`, `--shadow-btn-success`, `--shadow-btn-danger`: bevel highlight + a faint matching under-glow) — they're applied by the `Button` component, not by you.

### 2.6 Motion

| Token | Duration | Use |
|-------|----------|-----|
| `var(--motion-fast)` | 120ms | Hover color/opacity changes |
| `var(--motion-base)` | 180ms | Default — buttons, cards, focus rings |
| `var(--motion-slow)` | 280ms | Drawer/modal enter, accordion expand |

Easing: `var(--ease-standard)` (`cubic-bezier(0.2, 0, 0.2, 1)`). No bouncy springs. No 500ms+ transitions on UI controls.

Animations defined globally: `fade-up` (entrance), `pulse-dot` (live indicator), `shimmer` (skeleton), `streaming-border` (active LLM stream), `btn-sheen` (periodic light sweep on a gold CTA — reserved for one-off milestone actions like the setup wizard's "Get started"; never on routine UI). Reuse these. Always honor `prefers-reduced-motion` — the streaming border already does; new animations must too.

---

## 3. Components — use what exists

`frontend/src/components/ui/` already covers the system. Default to importing, not rebuilding. Inventory:

**Controls:** `Button`, `IconButton`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`/`RadioGroup`, `Switch`, `SwitchPill` (labeled switch fused into a tinted pill), `Label`, `FormField`, `SegmentedControl`, `RowButton` (clickable list/grid rows), `Combobox`, `MultiCombobox` (searchable multi-select with optional `maxSelected` cap), `Tabs`, `Menu`, `Tooltip`, `FilterChip`, `FilterDropdown`, `FilterTabs`, `Pagination`.

`Select`, `Tabs`, `Tooltip`, `Menu`, `FilterDropdown`, `Combobox`, and `Popover` are **headless Radix** (`@radix-ui/react-*`) styled with our tokens — they handle keyboard nav, focus, and portalling. Never hand-roll a dropdown/menu/tooltip/tab/popover with manual `createPortal` + `getBoundingClientRect` again, and never fall back to a native `<select>` (its option list is OS-rendered and off-theme); reach for these. `Select` keeps the `<option>`-children API but emits the chosen value via `onValueChange(value)`, not a DOM `onChange` event.

**Surfaces:** `Card` (with `Card.Header`/`Body`/`Footer`), `KpiCard`, `EmptyState`, `Skeleton`, `Spinner`, `ListRail` (with `RailHeader` — the locked master/detail left column, see §4).

**Data display:** `DataTable`, `Badge`, `Pill`, `ColoredBadge`, `StatusDot`, `ProgressBar`, `Avatar`, `CodeBlock`, `JsonBlock`, `MessageBubble`, `ToolMessageBubble`, `ModelParametersGrid`, `Collapsible`, `Toast`.

**Overlays:** `Modal`, `Drawer`, `ConfirmDialog`, `StepWizard` (`components/overlays/`), `Popover` (Radix-backed floating panel for rich filter/picker content — for a flat action list use `Menu`).

**Layout:** `Shell`, `NavItem`, `ProjectSelector` (`components/layout/`).

### 3.1 Button rules

`<Button variant="primary|secondary|ghost|danger|dangerOutline|success|link" size="sm|md|lg">`. Defaults: `primary`, `md`. Use:

- **primary** — the one obvious action per screen/section. Save, Run Test, Create Suite. **Gold gradient fill with dark ink** (`bg-[image:var(--grad-accent)]` + `text-accent-ink`) — this filled treatment is the primary action's alone; never gold-fill a label, tab, chip, or input. One per toolbar/region.
- **secondary** — neutral siblings. Cancel, Close, Edit.
- **ghost** — tertiary in toolbars and inline rows.
- **danger** — irreversible, solid red. Always paired with `ConfirmDialog`.
- **dangerOutline** — lower-emphasis destructive (outlined, tints on hover) — e.g. a header-row "Delete".
- **success** — only for "approve" / "promote" semantics; do not use for generic save.
- **link** — inline text action ("Set price →", "View cases ›"): no padding, accent text, underline on hover.

`loading` shows a spinner + disables; `leftIcon`/`rightIcon` for icons; `fullWidth` to fill; `asChild` renders the single child (`<a>` / router `<Link>`) with button styling instead of `<div onClick>`. Write variants (`primary`/`danger`/`dangerOutline`/`success`) auto-emit `data-write` for kiosk gating — pass `data-write` explicitly on a `ghost`/`secondary`/`link`/`IconButton` that mutates.

**Raw `<button>`/`<input>`/`<select>`/`<textarea>` are ESLint-forbidden** (`no-restricted-syntax`) everywhere except the `components/ui/` primitive layer — use the primitive. Icon-only → `IconButton`; clickable list/grid row → `RowButton`. For a genuinely bespoke control (range slider, labeled switch-pill, command palette) add a one-line `// eslint-disable-next-line no-restricted-syntax -- <reason>`.

### 3.2 Card rules

`<Card elevation="flat|raised|floating" padding="none|sm|md|lg">`. Defaults: `raised`, `md`.

- **flat** — list rows, inline panels inside another card.
- **raised** — default standalone card.
- **floating** — only inside overlays (modal/drawer body sections).

Use `Card.Header` / `Card.Body` / `Card.Footer` for structure. `accentBar` for left/top bar tinting in entity cards (e.g. agent card colored by `agentColor`). `hoverGlow` for interactive list cards. Never put a shadow on a flat card.

### 3.3 Pill / Badge rules

Status, kind, and entity tags = `Pill` or `Badge` (tinted variant). Always pair with semantic color when meaning is fixed (success / warn / danger) and with `modelColor` / `agentColor` when meaning is per-entity. Pills are read at a glance — keep label ≤ 18 chars, no full sentences.

### 3.4 DataTable rules

Use `DataTable` for any tabular dataset > 5 rows. For trace lists specifically, the existing `trace-row` pattern (CSS grid, border-bottom hairline, hover wash) is the canonical layout — follow it for any new high-volume scrolling list.

### 3.5 Empty + loading states

- **Empty:** `EmptyState` with a one-line headline + one-line hint + optional CTA. No clipart.
- **Loading:** `Skeleton` for shaped placeholders (always reserve the final layout's height to prevent jump). `Spinner` only for inline button loading and indeterminate small areas. `streaming-border` class on a card whose contents are mid-stream.
- **Error:** Inline `text-danger` message near the failing control. For full-page failures, `EmptyState` variant with the danger color.

### 3.6 Form controls, toggles, and menus

- **Text/number/password** → `Input` (`leftAddon`/`rightAddon` for icons/affordances); **long text** → `Textarea`; **short option list** → `Select` (Radix-backed styled dropdown, `<option>` children + `onValueChange`); **searchable/entity list** → `Combobox`; **searchable multi-select** (pick several from a long list, optional cap) → `MultiCombobox`. Wrap each in `FormField` (or pair with `Label`). Inline (flex-row) fields need a width wrapper — `Input`/`Select` are `w-full`.
- **Boolean** → `Switch` (on/off) or `Checkbox`; **one-of-N** → `Radio`/`RadioGroup`, or `SegmentedControl` for a compact toggle bar.
- **Tabs** → `Tabs` (pass `data-testid` per item where e2e needs it). **Dropdown menu** → `Menu` + `Menu.Item`/`Menu.Separator`. **Tooltip** → `Tooltip` (the single `TooltipProvider` is already mounted in `App.tsx`).

---

## 4. Layout patterns

- **App shell:** `Shell` provides sidebar + top bar + main scroll area. Don't render a custom shell per route.
- **Page header:** `text-h1` title, `text-body-sm text-muted` subtitle one line below, primary action top-right.
- **Section header:** `text-title` label uppercase-tracking-wide is *not* our style — use sentence case `text-h2 font-semibold`.
- **KPI rows:** `KpiCard` grid, 3–5 cards, `text-display` for the value, `text-body-sm text-muted` for the label, optional delta with semantic color.
- **Detail views:** Drawer (right-side) for entity detail when the list still matters (traces, runs, proposals). Modal for focused tasks (create wizard, confirm). Full-page route only when the detail has its own sub-navigation.
- **Master/detail list rail — the locked left column.** Every master/detail view (Agents, Evaluators, Test Suites, Test Runs, Evaluator Playground) shares one left-column shell: `ListRail` (`components/ui/ListRail.tsx`). **Do not hand-build a list header again.** Its anatomy is fixed, top to bottom:
  1. **Header** (`RailHeader`): a sentence-case title + optional count badge (Row A); an optional primary **create** button (Row B); an optional **search** box (Row C). Omitted slots collapse — a view with no create (Agents, Runs) or no search (Runs) still reads as the same panel, so don't reserve phantom gaps.
  2. **Filter band:** one locked slot below the header for the view's filter control (`SegmentedControl`, `FilterDropdown size="sm"`, or a bespoke toggle pill). Keep its contents `w-full` / `size="sm"` so heights stay consistent across views.
  3. **Body:** the scrolling rows, with built-in loading (`SkeletonList`) and empty (`EmptyState`) states. The view passes rows as `children` and owns their inner flex/gap; pass `isEmpty` so the shell swaps in the empty node.
  The shell is a **framed card** (`bg-card rounded-lg shadow-[var(--shadow-card)]`), so rows sit flat on it — inactive rows are `bg-transparent hover:bg-card-2` (**no per-row shadow**; the shell owns elevation). The selected row uses the **canonical selection treatment**: an entity-colored gradient wash + inset ring + 3px left bar — via `lib/selectionRow.ts` (`selectionRowStyle` / `selectionBarStyle` / `SELECTION_ROW_INACTIVE`) for runtime-hex colors (agent/evaluator/model), or the matching `categorySelectedRow` classes for token colors. Lock the split width with the exported `LIST_RAIL_COLS` grid template — never hand-tune per-view column widths. **Exception:** the Evaluator Playground rail is two stacked pickers (evaluator + past evaluations), so it reuses the card shell, `RailHeader`, and selection treatment but keeps its own two-section body instead of `ListRail`'s single list. *(A future `MasterDetail` wrapper could also own the right pane + mobile select-first behavior; today only the left column is shared.)*
- **Responsiveness:** the app must stay usable down to 1024px wide. The sidebar starts collapsed below 1280px (`Shell` checks `matchMedia` once at mount; the user's toggle is never overridden). Inside a master/detail pane, **don't use viewport breakpoints (`lg:`/`xl:`) to split columns — they lie about the pane's actual width** (sidebar + list eat into it). Use Tailwind 4 container queries instead: `@container` on the pane root, `@3xl:grid-cols-[…]` on the split (see `AgentDetail.tsx`). Multi-column stat/KPI strips wrap (`flex-wrap` with a content-true `min-w`, or `grid-cols-[repeat(auto-fit,minmax(…,1fr))]`) rather than overflow. Shared row grids (e.g. `COL_WIDTHS` in `tracesMeta.ts`) use `minmax(min,max)` columns so they compress before clipping.
- **Mobile (< `md`, 768px) — monitoring tier:** phones get a read/monitor experience; authoring stays desktop-first. The patterns:
  - **Shell:** the sidebar becomes an off-canvas drawer (backdrop + slide-in, closes on nav click); the topbar drops the search box and license badge below `sm` and the health pill collapses to its dot below `lg`. Behavior branches use `useIsMobile()` (`hooks/useMediaQuery.ts`); styling branches use `max-md:`/`md:` classes.
  - **Master/detail pages** (agents, runs): list and detail become separate screens. Only an *explicit* `?id=` selection opens the detail (the desktop select-first default is suppressed on mobile) and a ghost "All …" back button clears it — see `Runs.tsx` / `Agents.tsx`.
  - **Wide row grids** (trace list): low-priority columns collapse via container query — the list declares `@container` + exposes full/narrow templates as CSS vars, rows share `TRACE_GRID_CLS`, hidden cells carry `@max-2xl:hidden` (`tracesMeta.ts`).
  - **Full-height internal-scroll layouts** become natural page scroll below `md` (`md:h-full md:min-h-0` on the page root — see `Traces.tsx`); horizontal stat strips that can't wrap get `overflow-x-auto`.

---

## 5. Icons

- **Source:** the in-repo icon set at `components/icons` (import through its barrel; the `Svg` wrapper handles `size`/`currentColor`). `lucide-react` is **not** a dependency — don't add it. See BEST_PRACTICES.md §6 for the code rule. Default size 16. 14 in dense rows, 20 in headers, 24 only in empty states.
- **No emoji as icons. Ever.** Even in placeholder copy.
- **Stroke width:** default (2). Don't mix stroke widths within a screen.
- Always pair an icon-only button with `aria-label`.

---

## 6. Inline styles policy

The default is **no inline styles**. Use Tailwind utilities, including arbitrary-value syntax for tokens:

```tsx
// good
<div className="bg-card rounded-lg shadow-[var(--shadow-card)] p-4">
<button className="bg-[image:var(--grad-accent)] hover:bg-[image:var(--grad-accent-hover)]">

// bad — static value as inline style
<div style={{ background: '#27272c', borderRadius: 14 }}>
```

Inline `style={{ ... }}` is acceptable **only** for genuinely runtime-computed values: a percent width from data, a runtime hex from `modelColor()`, a numeric `borderRadius` prop forwarded to a primitive. If the value is static, it belongs in className.

---

## 7. Interaction & accessibility (non-negotiable)

- **Cursor:** `cursor-pointer` on every clickable surface, including cards. Already encoded in `Button` and in `Card` when `interactive` or `hoverGlow`.
- **Hover:** color/background change only. Never a `scale()` transform on elements that share layout flow — it shifts neighbors. Box-shadow + bg-wash is the pattern.
- **Focus:** every interactive element gets a visible focus ring. The pattern is `focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)]`. `Button` already does this — match the pattern in custom controls.
- **Keyboard:** Tab order = visual order. Modal/drawer trap focus and close on Esc (the existing components do; new ones must).
- **Labels:** every form input pairs with a `<label>` (use `FormField`). Icon-only buttons get `aria-label`.
- **Contrast:** primary text on every surface above is ≥ 7:1; secondary ≥ 4.5:1; muted ≥ 3:1 (caption only). Don't put `text-muted` on body content. Don't put `text-secondary` on `bg-card-2` for prose blocks.
- **Status by color is never the only signal.** Pair with an icon, label, or shape (a green dot beside the word "Passed", not a green dot alone).
- **Reduced motion:** if you add a keyframe animation, also add a `@media (prefers-reduced-motion: reduce)` rule that disables it.

---

## 8. Real-time / streaming UI

- Live trace incoming → `streaming-border` class on its row/card while open; `pulse-dot` on the live indicator in the top bar.
- New rows entering a list animate with `fade-up` (already in CSS). Don't reorder existing rows on insert — only prepend or append per the list's stated sort.
- Never block interaction during background updates. SSE updates are partial — patch the cached query, don't refetch the page.

---

## 9. Anti-patterns — do not introduce these

- Glassmorphism, frosted blur on regular cards (only modal overlay uses backdrop-blur, and only at 4px).
- Vibrant rainbow gradients, neon glows, or animated gradients on idle UI.
- Light-mode styles. Proxytrace is dark-only today; do not add light-mode classes "just in case." If/when light mode happens, it'll be a tracked initiative with new tokens.
- Custom shadows / radii / type sizes outside the scale.
- `border-2` or thicker borders on UI chrome — our borders are 1px hairlines. Thicker borders only on focus rings (2px) and explicit dividers.
- Decorative emoji in copy, headings, or buttons.
- Scale transforms on hover for elements in flow layout.
- `<div>` with onClick instead of a real button or anchor.
- `useEffect` to run a one-time fetch — use TanStack Query.
- Fetching inside a component when an SSE broadcaster already streams the data.
- `dangerouslySetInnerHTML` to render captured prompts / model output — render as text (`CodeBlock`, `<pre>`). See BEST_PRACTICES.md §12.
- Unsanitized data-derived `href`/`src` (allow only `http`/`https`/`mailto`); `target="_blank"` without `rel="noopener noreferrer"`.

---

## 10. Pre-flight checklist

Before opening a frontend PR, verify:

- [ ] No new hex values, no new px sizes outside the scale, no ad-hoc shadows.
- [ ] All static styles are Tailwind utilities; inline `style` only for runtime-computed values. Complex statics use arbitrary-value syntax (`shadow-[var(--shadow-card)]`), never inline `style`.
- [ ] Tokens used via `bg-card` / `text-primary` / `rounded-lg` / `shadow-[var(--shadow-…)]`, not raw hex or px.
- [ ] Reused existing component (`Button`, `Card`, `Pill`, `Modal`, `Drawer`, etc.) — no duplicate primitives.
- [ ] Cursor, hover, focus-visible all present on interactive elements.
- [ ] Icon-only buttons have `aria-label`.
- [ ] Form inputs use `FormField` (label + control).
- [ ] Empty / loading / error states exist for any async-driven view.
- [ ] No emoji-as-icon. Lucide only.
- [ ] No `prefers-reduced-motion`-blind animations.
- [ ] No light-mode classes.
- [ ] Untrusted content (prompts, model output, tool args) rendered as text — no `dangerouslySetInnerHTML`. Data-derived URLs scheme-checked; external links have `rel="noopener noreferrer"`. (Full rules: BEST_PRACTICES.md §12.)
- [ ] Streaming/live state uses `streaming-border` / `pulse-dot` where applicable.
- [ ] List/table layout matches `trace-row` / `DataTable` conventions.
- [ ] Visually scanned at 1024px, 1280px and 1440px widths; nothing horizontally scrolls. Master/detail panes use container queries (`@container` + `@3xl:` etc.), not viewport breakpoints (§4).

---

## 11. When to extend this guide

If you're about to introduce a *new* primitive, *new* token, or *new* pattern that future code will follow — pause, propose it, and update this file in the same PR. New tokens go in `index.css` and the `@theme` block; new primitives go in `components/ui/`. Drift in unowned files is the enemy.
