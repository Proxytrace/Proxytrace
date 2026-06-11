# Frontend review — follow-up items

Logged during the June 2026 frontend review (branch `review/frontend`). These are real but
small/deferred findings — the big/medium wins were fixed directly in that branch.

## Security

- **Local-auth JWT persisted in `localStorage`** (`src/auth/local/LocalAuthProvider.tsx`,
  key `proxytrace.token`). Readable by any script that gets past the CSP
  (`script-src 'self'` mitigates, but BEST_PRACTICES §12.3 calls for httpOnly cookies).
  Proper fix is a backend change: issue the session as an httpOnly, `SameSite=Strict`
  cookie and drop the bearer-token plumbing for local mode. The SSE stream-ticket
  mechanism already shows the pattern for non-header auth.
- `src/features/traces/PromoteModal.tsx:50` logs the raw error object via
  `console.error`; harmless today, but route it through the toast/error-report path
  like everything else for consistency.

## Code architecture (BEST_PRACTICES debt)

- **Raw `useQuery`/`useMutation` in 17 feature component files** (modals/pickers such as
  `PromoteModal.tsx`, `RunConfirmModal.tsx`, `AddMemberModal.tsx`, `AgentPicker.tsx`,
  `EndpointSelector.tsx`, `Setup.tsx`, `Dashboard.tsx`…). §3.1 wants these extracted into
  feature `use*` hooks. Mechanical, low-risk, but churny — do it feature-by-feature when
  touching each file, or as a tracked refactor.
- **`ToolEditor.tsx` (playground) keys tool cards by array index** while supporting
  removal — a card's local collapse state can shift to the wrong tool after a delete.
  Give `PlaygroundToolOverride` a stable client-side id at creation and key on it.
- **`ToolEditor.tsx` `TYPE_COLORS`** threads CSS-variable strings into inline styles —
  §5.1/§13 want a semantic→class mapping at the leaf.
- `src/components/search/EvaluatorPreview.tsx:24` keeps an `as [string, string][]`
  tuple cast; model the entries so the cast disappears.

## Performance (further, smaller wins)

- Main chunk is now 839 kB raw / 251 kB gzip (was 1.66 MB / 477 kB). Remaining weight is
  React + Router + TanStack Query + Radix + the eager shell (UnifiedSearch, charts in
  shared components). Only worth splitting further if first-paint metrics demand it.
- `tracey-tools` chunk bundles the 9 k-line generated docs index
  (`docs-index.generated.ts`, ~400 kB raw). It could be fetched on demand by the
  `search_docs` tool (static JSON asset) instead of being part of the JS chunk.
- Settings sections are eagerly imported in `App.tsx` (deliberate — small and
  admin-only). Revisit if they grow.

## Usability

- After local-auth signout the app navigates to `/login`, a path no route defines (the
  gate renders `Login` for any path, so it works) — consider a real `/login` route so
  the URL is honest and deep-linkable.
