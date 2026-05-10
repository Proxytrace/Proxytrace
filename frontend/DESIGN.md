# Trsr UI Design Guide

**Required reading before any frontend work.** This document is the source of truth for visual style, component conventions, and interaction patterns. Skim if you've read it before; obey it always. The codebase already implements these rules — your job is to extend the system, not invent a parallel one.

If a rule here conflicts with a generic design recommendation (from a tool, agent, or external skill), this guide wins.

---

## 1. Product context

Trsr is an AI-agent observability + benchmarking platform. The user is a developer or ML engineer staring at traces, test runs, evaluations, and proposals — often for long stretches. That dictates everything below:

- **Information density over whitespace luxury.** Body text is 12px, not 16px. Cards stack tightly. Whitespace earns its place.
- **Calm, not flashy.** Dark surface, single warm accent. No rainbows, no glassmorphism flourishes, no animated gradients on idle UI.
- **Code-adjacent feel.** Mono font for IDs, payloads, model names, JSON. Inter for prose.
- **Trust signals matter.** Status colors must be unambiguous. Number formatting must be consistent. Streaming/live state must be visible without being noisy.

Anti-personas: marketing landing page, e-commerce product, consumer app. Do not import patterns from those domains.

---

## 2. Theme system — design tokens

All tokens are declared in `frontend/src/index.css` and exposed to Tailwind 4 via `@theme`. **Never hardcode hex values, pixel sizes, or shadow strings in components.** Reference tokens through Tailwind utilities (`bg-card`, `text-secondary`, `rounded-lg`, `text-body-sm`) or arbitrary-value syntax against the CSS variable (`shadow-[var(--shadow-card)]`, `bg-[image:var(--grad-accent)]`).

### 2.1 Colors

Dark-only, single warm-amber accent.

| Role | Token | Hex | Use |
|------|-------|-----|-----|
| Page background | `bg-surface` | `#1b1b1f` | Body / app shell |
| Elevated surface | `bg-surface-2` | `#212125` | Modals, drawers, top bar |
| Sidebar | `bg-sidebar` | `#1e1e22` | Left nav |
| Card | `bg-card` | `#27272c` | Default card |
| Card raised | `bg-card-2` | `#303036` | Nested card / hovered list row |
| Border | `border-border` | rgba(255,255,255,0.07) | Default border |
| Border subtle | `border-border-subtle` | rgba(255,255,255,0.04) | Row dividers |
| Hairline | `border-hairline` | rgba(255,255,255,0.055) | Internal card splits |
| Text primary | `text-primary` | `#f0ede8` | Headings, key values |
| Text secondary | `text-secondary` | `#9e9a94` | Labels, body prose |
| Text muted | `text-muted` | `#67645e` | Captions, placeholders |
| Accent | `text-accent`, `bg-accent` | `#c9944a` | Primary CTAs, active nav, focus ring |
| Accent hover | `accent-hover` | `#deb073` | Hover only |
| Success | `text-success`, `bg-success` | `#3daa6f` | Pass, healthy, run-green |
| Warn | `text-warn` | `#d4915c` | Throttle, slow, 4xx |
| Danger | `text-danger` | `#d95555` | Fail, error, destructive |
| Teal | `text-teal` | `#6b9eaa` | Rule-based evaluators, info chips |

**Subtle semantic backgrounds** (`bg-success-subtle`, `bg-warn-subtle`, `bg-danger-subtle`, `bg-accent-subtle`) — use these for status pills and tinted surfaces. Never put white text on a subtle background; pair the subtle bg with the matching solid text color.

**Dynamic colors** (per-model, per-agent, per-evaluator) come from `frontend/src/lib/colors.ts`: `modelColor(name)`, `agentColor(id)`, `EVALUATOR_KIND_COLOR`, `statusColor(httpStatus)`. Hash-based assignment is stable — do not invent new palettes for new entity types; extend the existing helpers.

**Never** introduce new brand hexes. If you think you need one, you don't — combine accent + a semantic + opacity.

### 2.2 Typography

- **Body:** Inter, with feature-settings `cv11 ss01 ss03` (defined globally on `body`).
- **Mono:** JetBrains Mono (fallback Fira Code) — apply via `.mono` class or Tailwind `font-mono`. Use for IDs, model names, token counts, JSON, code, kbd hints.
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

Buttons have their own shadows baked into the variant (`--shadow-btn`, `--shadow-btn-success`, `--shadow-btn-danger`) — they're applied by the `Button` component, not by you.

### 2.6 Motion

| Token | Duration | Use |
|-------|----------|-----|
| `var(--motion-fast)` | 120ms | Hover color/opacity changes |
| `var(--motion-base)` | 180ms | Default — buttons, cards, focus rings |
| `var(--motion-slow)` | 280ms | Drawer/modal enter, accordion expand |

Easing: `var(--ease-standard)` (`cubic-bezier(0.2, 0, 0.2, 1)`). No bouncy springs. No 500ms+ transitions on UI controls.

Animations defined globally: `fade-up` (entrance), `pulse-dot` (live indicator), `shimmer` (skeleton), `streaming-border` (active LLM stream). Reuse these. Always honor `prefers-reduced-motion` — the streaming border already does; new animations must too.

---

## 3. Components — use what exists

`frontend/src/components/ui/` already covers the system. Default to importing, not rebuilding. Inventory:

**Controls:** `Button`, `IconButton`, `Input`, `Textarea`, `Select`, `FormField`, `FilterChip`, `FilterDropdown`, `FilterTabs`, `Pagination`.

**Surfaces:** `Card` (with `Card.Header`/`Body`/`Footer`), `KpiCard`, `EmptyState`, `Skeleton`, `Spinner`.

**Data display:** `DataTable`, `Badge`, `Pill`, `ColoredBadge`, `StatusDot`, `ProgressBar`, `Avatar`, `CodeBlock`, `JsonBlock`, `MessageBubble`, `ToolMessageBubble`, `ModelParametersGrid`, `Collapsible`, `Toast`.

**Overlays:** `Modal`, `Drawer`, `ConfirmDialog`, `StepWizard` (`components/overlays/`).

**Layout:** `Shell`, `NavItem`, `ProjectSelector` (`components/layout/`).

### 3.1 Button rules

`<Button variant="primary|secondary|ghost|danger|success" size="sm|md|lg">`. Defaults: `primary`, `md`. Use:

- **primary** — the one obvious action per screen/section. Save, Run Test, Create Suite.
- **secondary** — neutral siblings. Cancel, Close, Edit.
- **ghost** — tertiary in toolbars and inline rows.
- **danger** — irreversible. Always paired with `ConfirmDialog`.
- **success** — only for "approve" / "promote" semantics; do not use for generic save.

Never style a raw `<button>` with Tailwind for shape. If you need an icon-only control, use `IconButton`.

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

---

## 4. Layout patterns

- **App shell:** `Shell` provides sidebar + top bar + main scroll area. Don't render a custom shell per route.
- **Page header:** `text-h1` title, `text-body-sm text-muted` subtitle one line below, primary action top-right.
- **Section header:** `text-title` label uppercase-tracking-wide is *not* our style — use sentence case `text-h2 font-semibold`.
- **KPI rows:** `KpiCard` grid, 3–5 cards, `text-display` for the value, `text-body-sm text-muted` for the label, optional delta with semantic color.
- **Detail views:** Drawer (right-side) for entity detail when the list still matters (traces, runs, proposals). Modal for focused tasks (create wizard, confirm). Full-page route only when the detail has its own sub-navigation.

---

## 5. Icons

- **Source:** Lucide (`lucide-react`). Default size 16. 14 in dense rows, 20 in headers, 24 only in empty states.
- **No emoji as icons. Ever.** Even in placeholder copy.
- **Stroke width:** Lucide default (2). Don't mix stroke widths within a screen.
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
- Light-mode styles. Trsr is dark-only today; do not add light-mode classes "just in case." If/when light mode happens, it'll be a tracked initiative with new tokens.
- Custom shadows / radii / type sizes outside the scale.
- `border-2` or thicker borders on UI chrome — our borders are 1px hairlines. Thicker borders only on focus rings (2px) and explicit dividers.
- Decorative emoji in copy, headings, or buttons.
- Scale transforms on hover for elements in flow layout.
- `<div>` with onClick instead of a real button or anchor.
- `useEffect` to run a one-time fetch — use TanStack Query.
- Fetching inside a component when an SSE broadcaster already streams the data.

---

## 10. Pre-flight checklist

Before opening a frontend PR, verify:

- [ ] No new hex values, no new px sizes outside the scale, no ad-hoc shadows.
- [ ] All static styles are Tailwind utilities; inline `style` only for runtime-computed values.
- [ ] Tokens used via `bg-card` / `text-primary` / `rounded-lg` / `shadow-[var(--shadow-…)]`, not raw hex or px.
- [ ] Reused existing component (`Button`, `Card`, `Pill`, `Modal`, `Drawer`, etc.) — no duplicate primitives.
- [ ] Cursor, hover, focus-visible all present on interactive elements.
- [ ] Icon-only buttons have `aria-label`.
- [ ] Form inputs use `FormField` (label + control).
- [ ] Empty / loading / error states exist for any async-driven view.
- [ ] No emoji-as-icon. Lucide only.
- [ ] No `prefers-reduced-motion`-blind animations.
- [ ] No light-mode classes.
- [ ] Streaming/live state uses `streaming-border` / `pulse-dot` where applicable.
- [ ] List/table layout matches `trace-row` / `DataTable` conventions.
- [ ] Visually scanned at 1280px and 1440px widths; nothing horizontally scrolls.

---

## 11. When to extend this guide

If you're about to introduce a *new* primitive, *new* token, or *new* pattern that future code will follow — pause, propose it, and update this file in the same PR. New tokens go in `index.css` and the `@theme` block; new primitives go in `components/ui/`. Drift in unowned files is the enemy.
