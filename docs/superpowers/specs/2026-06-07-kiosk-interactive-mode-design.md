# Kiosk Interactive Mode

**Date:** 2026-06-07
**Status:** Approved (design)

## Problem

Kiosk mode currently runs a read-only demo on an in-memory DB with an auto-authenticated
demo user. A recent change let **Tracey** use a real LLM when an endpoint is configured
under `Kiosk:Endpoint`. We now want the *rest* of the product — running test suites,
evaluations, optimization proposals, and full CRUD on agents/suites/etc. — to work in
kiosk too, but only when that real LLM endpoint is configured.

Scope (confirmed):
- **Single user / private demo.** No per-session isolation. Shared demo tenant +
  in-memory DB is acceptable. Data lost on restart is fine.
- When an endpoint is configured, kiosk should behave like a normal single-user instance
  (full read-write, background test runner enabled).
- When no endpoint is configured, kiosk stays the current read-only browse-only demo.

## Core Concept

A single boolean unifies the behavior:

```
interactive = kiosk.Enabled is false  (normal install — always interactive)
           OR kioskEndpoint.IsConfigured  (kiosk WITH a real LLM endpoint)
```

`interactive == true` → full read-write + background processing.
`interactive == false` → only when `kiosk.Enabled && !endpoint.IsConfigured`: read-only demo.

This replaces the existing `tracey` flag, which already carried the identical condition.
There is one flag, `interactive`, exposed by the config API and consumed by the frontend.

## Current State (what gates features today)

Three mechanisms currently block features in kiosk:

1. **`KioskReadOnlyMiddleware`** (`Proxytrace.Api/Middleware/KioskReadOnlyMiddleware.cs`)
   — blocks every non-GET/HEAD/OPTIONS request in kiosk, with a single carveout: writes
   to `/api/tracey` are allowed when `endpoint.IsConfigured`.

2. **`TestRunnerService` registration** (`Proxytrace.Application/Module.cs:92–104`) —
   hard-replaced with `NullHostedService` whenever `kiosk.Enabled`, so background test
   runs never execute in kiosk.

3. **Frontend `body.kiosk [data-write]` CSS** (`frontend/src/index.css:492–498`) —
   disables (opacity + `pointer-events: none`) every control marked `data-write` whenever
   the `<body>` has the `kiosk` class.

Not gating / no change needed:
- Optimization hosted services `OptimizerService` + `TheoryValidationService`
  (`Proxytrace.Application/Optimization/Module.cs:47–57`) already run in every mode.
- `TraceQuotaGuard` is disabled in kiosk and stays disabled (it is a licensing/quota
  guard with no LLM dependency).
- `CoreSeedScenario` already routes the project `SystemEndpoint` and all demo agents
  through the real endpoint when configured, so evaluators/proposals resolve their LLM
  correctly with no extra wiring.
- Auth (`KioskAuthenticationHandler`) and in-memory DB selection stay as-is.

## Changes

### Backend

1. **`KioskReadOnlyMiddleware`** — change `IsAllowedWrite` from the tracey-only carveout
   to: allow all writes when `endpoint.IsConfigured`. Effectively, when the endpoint is
   configured the read-only restriction is lifted entirely; otherwise all writes stay
   blocked (the tracey path is moot without an endpoint anyway).

2. **`Proxytrace.Application/Module.cs`** TestRunnerService factory (lines ~92–104) —
   resolve `KioskEndpointOptions` alongside `KioskOptions` in the hosted-service factory.
   Use `NullHostedService` only when `kiosk.Enabled && !endpoint.IsConfigured`; otherwise
   resolve the real `TestRunnerService`. (`KioskEndpointOptions` is already a registered
   singleton.)

3. **`ConfigController`** — replace the `tracey` property with `interactive`:
   ```csharp
   public object Get() => new
   {
       kiosk = kioskOptions.Enabled,
       interactive = !kioskOptions.Enabled || kioskEndpoint.IsConfigured,
   };
   ```

### Frontend

4. **`KioskContext`** — replace `traceyAvailable` with `interactive` in `KioskState` and
   the default context value.

5. **`App.tsx`** — read `appConfig.interactive`; pass it into the context. Add the
   `body.kiosk` class only when `!interactive` (so the `[data-write]` kill-switch applies
   only to a read-only kiosk). Interactive kiosk leaves write controls live.

6. **Consumers of `traceyAvailable`** (`Shell.tsx`, `useTraceyChat.ts`) — switch to
   `interactive`. Behavior is unchanged because the condition is identical; this is a
   rename to the unified flag.

### Docs

7. Update `manual/admin/configuration.md` (kiosk-mode section) and any kiosk page in
   `manual/guide/`: document that configuring `Kiosk:Endpoint` unlocks **full interactive
   mode** — running test suites, evaluations, optimization proposals, and CRUD — not just
   Tracey. Keep the note that without an endpoint, kiosk is a read-only demo. Rebuild the
   Tracey docs index if it sources from the manual.

## Data Flow (interactive kiosk)

```
Browser (write control, enabled)
  → POST /api/...                 (middleware: endpoint.IsConfigured → allowed)
  → controller → application      (auto-auth demo user, in-memory DB)
  → e.g. test run created
  → TestRunnerService (running)   → ModelClient → real LLM (Kiosk:Endpoint)
  → results persisted → SSE broadcasters → UI updates
  → OptimizerService / TheoryValidationService consume runs → proposals
```

## Testing

- **Backend unit:** `KioskReadOnlyMiddleware` — write blocked when endpoint NOT
  configured; write allowed when endpoint configured. Cover GET always allowed and
  non-kiosk passthrough.
- **Backend unit / DI:** TestRunnerService hosted registration resolves the real service
  for (non-kiosk) and (kiosk + endpoint), and `NullHostedService` for (kiosk, no
  endpoint).
- **ConfigController:** returns `interactive=true` for non-kiosk, `true` for kiosk+endpoint,
  `false` for kiosk without endpoint.
- **Frontend:** KioskContext / Shell render with `interactive` true vs false; verify the
  `body.kiosk` class is present only when read-only.
- **e2e (optional, LLM-gated):** existing kiosk e2e stays read-only; a new interactive
  path needs a configured endpoint — only run where the LLM env is present (follow the
  existing llm-gated e2e pattern).

## Out of Scope (YAGNI)

- Per-session / multi-tenant isolation for a shared public kiosk.
- Persisting kiosk data across restarts.
- Re-enabling the OpenAI proxy or `TraceQuotaGuard` in kiosk.
