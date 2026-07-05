# Frontend Architecture & Design-System Discipline

Frontends rot in a specific way: every contributor (human or AI) makes locally reasonable styling and structure decisions that are globally inconsistent, until the codebase is a museum of five button styles, 1400-line page components, and hex values nobody can change. The cure is not taste — it is a small set of **written, enforceable contracts**: a design system document that must be read before coding, a primitives layer that is the only legal way to render controls, and mechanical limits (file size, lint rules) that turn "good style" into red CI. This file distills those contracts for reuse in any new project.

## Principles

1. **The visual system is a document, not a vibe.** Tokens, type scale, spacing, radii, shadows, motion, and interaction rules live in one written guide that is *required reading before any frontend work* — and that explicitly wins over any generic recommendation from a tool, agent, or external skill. Undocumented conventions cannot be followed by new contributors or AI assistants; documented ones can be enforced and extended.
2. **Two documents, sharp split: what it looks like vs. how it's built.** One guide owns the visual system (tokens, color, spacing, which primitive to render); a sibling owns code architecture (folders, hooks, data fetching, typing, limits). Where they touch, the visual doc states the rule and the code doc states the mechanics. Mixing them produces a document nobody finishes reading.
3. **One way to render a control.** All buttons, inputs, selects, etc. go through a project-owned primitives layer; raw HTML controls are *lint-blocked* outside it. Consistency by construction beats consistency by review.
4. **Rules that matter are enforced by machines.** File-size limits, no-inline-style, no-`any`, no-raw-controls — each is either an ESLint rule, a greppable CI check, or a checklist item. A rule that only lives in someone's head is a preference, not a rule.
5. **Every rule states the failure mode it prevents.** "No hardcoded hex" exists because hardcoded values make retheming impossible; "no fetch in components" exists because it scatters cache invalidation. Rules with rationale get followed; arbitrary rules get argued with.
6. **Debt is not precedent.** The guide describes the *target state*; existing violations are named as debt. When touching a debt file: don't make it worse, leave clean seams, boy-scout the slice you're in. Large rewrites are tracked refactors, not drive-bys.
7. **The system is extended, not forked.** New tokens, primitives, or patterns go into the system *and its document* in the same PR. Drift in unowned files is the enemy.

## Patterns

### 1. Design-token vocabulary as the only styling language

**Problem:** Hardcoded hex values, ad-hoc pixel sizes, and one-off shadows accumulate until no global change (retheme, dark mode, density adjustment) is possible, and no two cards look alike.

**Solution:** Declare every color, type size, radius, shadow, and motion duration once as named tokens (CSS custom properties exposed to the utility framework — e.g. Tailwind's `@theme` block, as one instantiation). Components reference tokens only (`bg-card`, `text-body-sm`, `rounded-lg`, `shadow-[var(--shadow-card)]`). The written guide carries the full token table with a **"Use" column** — each token names when it applies, not just what it is. Introducing a new brand color or off-scale size is explicitly forbidden: "if you think you need one, you don't — combine existing tokens."

**Rationale:** Tokens make the design system *diffable*. A reviewer can grep for raw hex/px and reject it mechanically; a retheme is a token-file edit, not a codebase sweep.

Keep the scales deliberately small and collapsed: e.g. exactly four radii, three shadow tiers, three motion durations, one type scale with per-token usage rules. A scale with twenty entries is no scale at all. Semantic status colors (success/warn/danger) and stable hash-based entity colors (per-model, per-user, per-category) come from shared helpers, never invented per feature.

### 2. Product-context preamble that sets the design's center of gravity

**Problem:** Contributors import patterns from the wrong genre — marketing-site whitespace into a dense data tool, dashboard density into a content site.

**Solution:** Open the design guide with who the user is and what that dictates (density vs. whitespace, calm vs. expressive, type sizes), and name explicit **anti-personas** ("do not import patterns from landing pages / e-commerce / consumer apps"). Pair it with a written **anti-patterns list** (e.g. no glassmorphism, no scale-on-hover in flow layout, no emoji-as-icons, no `<div onClick>`) so genre violations are cited, not debated. When a showpiece surface genuinely needs to exceed the baseline, grant a *scoped, documented exception* (named routes, named animations, everything else still binds) rather than letting the baseline erode.

**Rationale:** Most visual inconsistency is not bad taste but wrong genre. Stating the genre once prevents a thousand micro-corrections — and scoped exceptions keep "special" surfaces from becoming precedent.

### 3. UI primitives layer as the only control surface

**Problem:** Ad-hoc `<button>`/`<input>`/`<select>` markup duplicates styling, misses focus rings and aria attributes, and drifts per feature. Hand-rolled dropdowns/tooltips get keyboard navigation and portalling wrong.

**Solution:** A `components/ui/` layer owns every control primitive (Button with variants/sizes/loading, Input, Select, Checkbox, Tabs, Menu, Tooltip, Modal, Drawer, Card, EmptyState, Skeleton, …). Raw HTML control elements are **blocked by a lint rule** (e.g. ESLint `no-restricted-syntax`) everywhere except inside that layer. Complex widgets wrap a headless accessible library (e.g. Radix) styled with the tokens, rather than reimplementing focus management. A genuinely bespoke control gets a one-line lint-disable *with a stated reason* — the escape hatch is visible and auditable.

```text
components/ui/Button.tsx      ← variants: primary|secondary|ghost|danger…; focus ring, loading, aria baked in
features/anything/Foo.tsx     ← <Button variant="primary">Save</Button>   ✔
                                <button className="...">Save</button>     ✘ lint error
```

**Rationale:** Accessibility, focus, theming, and interaction rules are implemented once and inherited everywhere. The lint rule converts the convention into a build failure — the only kind of convention that survives many contributors.

Give variants **semantic usage rules** in the guide ("primary = the one obvious action per screen; danger always pairs with a confirm dialog"), so the primitive constrains information hierarchy, not just pixels.

### 4. Feature-folder organization with a thin orchestrator page

**Problem:** Route components absorb their subcomponents, constants, and data logic until they are unreadable and untestable monoliths.

**Solution:** One folder per route/feature with a standard internal shape; the page component is *orchestration only* — route params in, hooks called, subcomponents laid out.

```text
features/<feature>/
  <Feature>.tsx        # thin page, lazy-loaded at the route. No fetch, no business logic.
  components/          # presentational subcomponents, one per file
  hooks/               # data + behavior hooks
  <feature>.ts         # pure constants, label maps, form initializers — unit-testable
  *.spec.ts            # tests for the pure logic
```

Cross-feature UI promotes up to `components/ui/`; cross-feature logic to shared `hooks/`/`lib/`. **Features never import each other's internals** — shared code moves up, it is not reached across.

**Rationale:** Pure logic in a `.ts` file is testable; logic buried in a 1400-line component is not. The no-cross-import rule keeps features deletable and refactorable in isolation.

### 5. Data fetching isolated in named hooks

**Problem:** Raw query/fetch calls in page components couple them to cache keys, stale times, and invalidation; `useEffect`-to-fetch reinvents loading states badly and races on unmount.

**Solution:** A strict layering — component → feature query hook (`useThings()`) → typed API service module → shared HTTP client. Pages never call the query library or `fetch` directly. All cache keys come from **one central key registry**; mutations invalidate by key, components never manually refetch. Dependent queries gate with an `enabled` guard instead of fetching with undefined ids. Server state lives only in the query cache — never copied into local state "to edit it" (derive, or keep an explicitly separate draft). List queries fetch light row DTOs (ids, names, counts); the fat object loads only on selection via a detail hook — keeping list payloads O(row fields), not O(nested graph).

**Rationale:** Centralizing keys and invalidation makes cache behavior auditable in one file. Light-list/fat-detail keeps scrolling fast at scale. "Server data copied into `useState`" is called out because it is empirically the most common frontend bug source: two sources of truth that silently diverge.

Corollary: **`useEffect` is a code smell until proven otherwise.** It is legal only for synchronizing with something outside the framework (subscriptions, timers, DOM measurement) — and then it lives in a dedicated custom hook, not inline. Fetching → query library; derived values → compute or memo; prop-driven reset → `key`; reacting to user action → the event handler.

### 6. Size and complexity limits as hard, greppable numbers

**Problem:** "Keep components small" is unenforceable; monster files grow one reasonable-seeming addition at a time.

**Solution:** Publish numeric soft/hard limits and treat the hard limit as a merge blocker (CI-grep if needed). One project's working numbers, as illustration:

| Unit | Soft | Hard | At hard limit |
|------|------|------|---------------|
| File | 200 lines | 300 | split before merging |
| Component function | 80 lines | 150 | extract subcomponents |
| Props on one component | 5 | 8 | group or split |
| Custom hook | 60 lines | 120 | extract helpers |

Plus: max two component functions per file (tiny once-used private helpers excepted). Keep a named before/after exhibit in the doc — "this page was once 1432 lines with 27 nested components; it is now a ~190-line orchestrator — don't regress it."

**Rationale:** Numbers end arguments. A limit that can be checked by `wc -l` gets enforced; a principle doesn't. The exhibit makes the target state concrete and marks the old shape as debt, not precedent.

### 7. No inline styles, no type escapes — with a precise runtime exception

**Problem:** Inline `style={{}}` bypasses the token system invisibly; `any`/`as any`/non-null `!` bypass the type system exactly where attacker- or edge-shaped data will break it.

**Solution:** Static styles are utility classes, always — including complex values via arbitrary-value syntax against tokens (`shadow-[var(--shadow-card)]`), never `style={{ boxShadow: … }}`. Inline `style` is legal *only* for genuinely runtime-computed values (a percent width from data, a hash-derived entity color). Conditional classes compose through one `cn()` helper; a class recipe copy-pasted 3+ times becomes a shared entry or a component. Don't thread CSS-variable strings through props — pass a semantic prop (`variant="danger"`) and map to a class at the leaf. On types: no `any`, no `as any`, no `!`; DTOs typed once in a shared models module; narrow with guards.

**Rationale:** "Only runtime-computed values" is a bright line a reviewer can apply in two seconds: if the value is knowable at author time, it's a class. Semantic props keep styling decisions at the leaf where the token mapping lives, instead of smeared through the tree.

### 8. Presentational/container split and mandatory async states

**Problem:** Every component fetching and rendering makes nothing reusable or testable; async views that ship only the happy path show blank grids and unexplained spinners.

**Solution:** Few containers (the page plus a couple of orchestrators) call hooks and hold state; many presentational components take props and return markup. Every async view ships **loading, empty, and error states** — skeletons shaped like the final layout (reserve height; no jump), a distinct empty state (empty ≠ loading), inline errors near the failing control, and an error boundary at the route so a render throw can't blank the app. Interactive elements and dynamic list rows carry stable `data-testid` attributes under a written naming convention, so e2e tests bind to a contract instead of to copy or CSS classes.

**Rationale:** The presentational majority is what makes a tree readable and testable. Making the three async states a checklist item (not a judgment call) is the only way they consistently exist. Test ids decouple test stability from wording and refactors.

## Pitfalls

- **Writing the design doc after the code.** The document must precede and gate contributions ("required reading before any frontend work") or it becomes a description of drift instead of a contract.
- **A primitives layer without the lint rule.** If raw controls still compile, the layer decays into a suggestion; the block plus a visible, reasoned escape hatch is what holds.
- **Token scales that grow on demand.** Every "just one more radius/shadow/hex" request erodes the system; the doc must pre-commit to "combine existing tokens" as the answer.
- **Treating existing violations as license.** Without an explicit "debt, not precedent" clause, every monster file justifies the next one.
- **Speculative flexibility** — light-mode classes in a dark-only app, unused variants, `useMemo` sprinkled everywhere "for performance." Add capability when a tracked need exists; measure before memoizing.
- **Rules without rationale.** Contributors (especially AI agents) route around rules they perceive as arbitrary; each rule should name its failure mode in the doc itself.
- **Skipping the checklist.** Both guides end in pre-merge checklists (visual + code); PRs must pass both. A checklist that isn't required at PR time is decoration.

## Checklist for a new project

- [ ] Write the design-system doc first: product context + anti-personas, token tables with "use" columns, type scale, radii/shadow/motion scales, interaction & accessibility rules, anti-patterns list, extension rule ("new token/primitive ⇒ update this doc in the same PR").
- [ ] Write the sibling code-architecture doc: size limits table, feature-folder shape, data-layer layering, `useEffect` policy, typing rules, testing expectations — and a pre-merge checklist in each doc.
- [ ] Mark both docs as mandatory pre-reading (top of the repo/agent instructions), stating they override generic tool/agent advice.
- [ ] Declare all tokens in one place; wire them into the styling framework; ban raw hex/px in components from day one.
- [ ] Build the `components/ui/` primitives layer before the first feature: Button (variants/sizes/loading/focus), Input + form field, Select/Tabs/Menu/Tooltip on a headless accessible base, Card, Modal/Drawer, EmptyState/Skeleton/Spinner.
- [ ] Add the lint rules on day one: raw HTML controls blocked outside `components/ui/`; no-`any` family; unlocalized-string rule if multilingual (see the i18n guide).
- [ ] Set up the data layer skeleton: HTTP client wrapper, typed per-resource API modules, central query-key registry, and the "hooks only, never raw queries in pages" rule.
- [ ] Establish the feature-folder template and the no-cross-feature-import rule.
- [ ] Adopt the size limits and decide how they're enforced (CI grep or review checklist).
- [ ] Require loading/empty/error states and `data-testid` conventions from the first feature — retrofitting either across a grown app is miserable.
