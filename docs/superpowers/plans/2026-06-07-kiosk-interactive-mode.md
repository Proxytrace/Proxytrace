# Kiosk Interactive Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a real LLM endpoint is configured in kiosk mode (`Kiosk:Endpoint`), unlock the full product — running test suites, evaluations, optimization proposals, and CRUD — instead of only Tracey.

**Architecture:** Collapse the existing `tracey` availability flag into a single `interactive` flag (`!kiosk OR endpoint.IsConfigured`). Backend lifts the kiosk read-only middleware and enables the background test runner whenever interactive; frontend drops the `body.kiosk` write kill-switch and renames the flag through its consumers. Optimization services already run in every mode and need no change.

**Tech Stack:** .NET 10 / ASP.NET Core / Autofac (backend), React 19 / Vite / TypeScript / TanStack Query (frontend), MSTest + AwesomeAssertions (backend tests), VitePress (manual).

**Spec:** `docs/superpowers/specs/2026-06-07-kiosk-interactive-mode-design.md`

---

## File Structure

**Backend (modify):**
- `Proxytrace.Api/Controllers/ConfigController.cs` — emit `interactive` instead of `tracey`.
- `Proxytrace.Api/Middleware/KioskReadOnlyMiddleware.cs` — allow all writes when endpoint configured.
- `Proxytrace.Application/Module.cs` — TestRunnerService hosted-service gate (lines ~92–104).

**Backend (tests):**
- `Proxytrace.Api.Tests/Kiosk/KioskReadOnlyMiddlewareTests.cs` — update + add cases.
- `Proxytrace.Api.Tests/Config/ConfigControllerTests.cs` — new.

**Frontend (modify):**
- `frontend/src/api/config.ts` — `tracey` → `interactive` on `AppConfig`.
- `frontend/src/contexts/KioskContext.tsx` — `traceyAvailable` → `interactive`.
- `frontend/src/App.tsx` — pass `interactive`, gate `body.kiosk` class on `!interactive`.
- `frontend/src/components/layout/Shell.tsx` — consume `interactive`.
- `frontend/src/features/tracey/useTraceyChat.ts` — consume `interactive`.

**Docs (modify):**
- `manual/admin/configuration.md` — document interactive kiosk.

---

## Task 1: ConfigController emits `interactive`

**Files:**
- Modify: `Proxytrace.Api/Controllers/ConfigController.cs`
- Test: `Proxytrace.Api.Tests/Config/ConfigControllerTests.cs` (create)

Note: `Proxytrace.Api` has `InternalsVisibleTo` for `Proxytrace.Api.Tests` (the existing
middleware test consumes an internal type), so a `dynamic` assertion on the anonymous
result object works from the test assembly.

- [ ] **Step 1: Write the failing test**

Create `Proxytrace.Api.Tests/Config/ConfigControllerTests.cs`:

```csharp
using AwesomeAssertions;
using Proxytrace.Api.Controllers;
using Proxytrace.Application.Demo;

namespace Proxytrace.Api.Tests.Config;

[TestClass]
public sealed class ConfigControllerTests
{
    private static KioskEndpointOptions ConfiguredEndpoint() => new()
    {
        BaseUrl = "https://api.openai.com/v1",
        ApiKey = "sk-test",
        Model = "gpt-4o",
    };

    [TestMethod]
    public void Get_NonKiosk_InteractiveTrue()
    {
        var controller = new ConfigController(
            new KioskOptions { Enabled = false }, new KioskEndpointOptions());

        dynamic result = controller.Get();

        ((bool)result.kiosk).Should().BeFalse();
        ((bool)result.interactive).Should().BeTrue();
    }

    [TestMethod]
    public void Get_KioskWithEndpoint_InteractiveTrue()
    {
        var controller = new ConfigController(
            new KioskOptions { Enabled = true }, ConfiguredEndpoint());

        dynamic result = controller.Get();

        ((bool)result.kiosk).Should().BeTrue();
        ((bool)result.interactive).Should().BeTrue();
    }

    [TestMethod]
    public void Get_KioskWithoutEndpoint_InteractiveFalse()
    {
        var controller = new ConfigController(
            new KioskOptions { Enabled = true }, new KioskEndpointOptions());

        dynamic result = controller.Get();

        ((bool)result.kiosk).Should().BeTrue();
        ((bool)result.interactive).Should().BeFalse();
    }
}
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `dotnet test Proxytrace.Api.Tests --filter ConfigControllerTests`
Expected: FAIL — `result.interactive` does not exist (current controller emits `tracey`).

- [ ] **Step 3: Update the controller**

In `Proxytrace.Api/Controllers/ConfigController.cs`, replace the `Get()` body:

```csharp
    [HttpGet]
    [AllowAnonymous]
    public object Get() => new
    {
        kiosk = kioskOptions.Enabled,

        // Interactive = full read-write. Always true outside kiosk; in kiosk only when a
        // real LLM endpoint is configured (unlocks runs, evaluations, proposals, CRUD).
        interactive = !kioskOptions.Enabled || kioskEndpoint.IsConfigured,
    };
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `dotnet test Proxytrace.Api.Tests --filter ConfigControllerTests`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add Proxytrace.Api/Controllers/ConfigController.cs Proxytrace.Api.Tests/Config/ConfigControllerTests.cs
git commit -m "Emit interactive flag from ConfigController"
```

---

## Task 2: KioskReadOnlyMiddleware lifts read-only when endpoint configured

**Files:**
- Modify: `Proxytrace.Api/Middleware/KioskReadOnlyMiddleware.cs`
- Test: `Proxytrace.Api.Tests/Kiosk/KioskReadOnlyMiddlewareTests.cs`

- [ ] **Step 1: Update the existing tests and add new cases**

In `Proxytrace.Api.Tests/Kiosk/KioskReadOnlyMiddlewareTests.cs`:

Rename `InvokeAsync_KioskEnabled_WriteRequest_ReturnsForbidden` to make the no-endpoint
condition explicit, and add a positive case for a non-Tracey write with a configured
endpoint. Replace those two methods (keep the others) with:

```csharp
    [TestMethod]
    public async Task InvokeAsync_KioskEnabled_WriteWithoutEndpoint_ReturnsForbidden()
    {
        var (ctx, next) = await InvokeAsync(
            "POST", "/api/agents", new KioskOptions { Enabled = true }, new KioskEndpointOptions());

        next.Should().BeFalse();
        ctx.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    [TestMethod]
    public async Task InvokeAsync_KioskEnabled_WriteWithConfiguredEndpoint_PassesThrough()
    {
        var (ctx, next) = await InvokeAsync(
            "POST", "/api/test-run-groups", new KioskOptions { Enabled = true }, ConfiguredEndpoint());

        next.Should().BeTrue();
        ctx.Response.StatusCode.Should().NotBe(StatusCodes.Status403Forbidden);
    }
```

(The existing `InvokeAsync_KioskEnabled_TraceyWriteWithConfiguredEndpoint_PassesThrough`
and `..._TraceyWriteWithoutEndpoint_ReturnsForbidden` tests stay valid and unchanged: a
configured endpoint still allows the Tracey write; no endpoint still forbids it.)

- [ ] **Step 2: Run the tests, verify the new positive case fails**

Run: `dotnet test Proxytrace.Api.Tests --filter KioskReadOnlyMiddlewareTests`
Expected: FAIL on `InvokeAsync_KioskEnabled_WriteWithConfiguredEndpoint_PassesThrough`
— current middleware only allows `/api/tracey` writes, so `/api/test-run-groups` is 403.

- [ ] **Step 3: Update the middleware**

In `Proxytrace.Api/Middleware/KioskReadOnlyMiddleware.cs`, replace `IsAllowedWrite`:

```csharp
    // When a real LLM endpoint is configured, kiosk becomes a fully interactive single-user
    // instance: lift the read-only restriction entirely. Without an endpoint the demo stays
    // read-only (and the Tracey write path is unreachable anyway, since it needs the endpoint).
    private bool IsAllowedWrite(HttpRequest request)
        => endpoint.IsConfigured;
```

The `request` parameter is now unused but kept for signature stability and a clear call
site; if the analyzer flags it, discard at the call site instead:
change `!IsAllowedWrite(context.Request)` to `!IsAllowedWrite()` and drop the parameter.
Pick whichever keeps the build warning-free — prefer dropping the parameter:

```csharp
    private bool IsAllowedWrite() => endpoint.IsConfigured;
```
and update the guard:
```csharp
        if (!ReadMethods.Contains(method) && !IsAllowedWrite())
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `dotnet test Proxytrace.Api.Tests --filter KioskReadOnlyMiddlewareTests`
Expected: PASS (all cases, including both Tracey cases and the new non-Tracey write).

- [ ] **Step 5: Commit**

```bash
git add Proxytrace.Api/Middleware/KioskReadOnlyMiddleware.cs Proxytrace.Api.Tests/Kiosk/KioskReadOnlyMiddlewareTests.cs
git commit -m "Lift kiosk read-only when LLM endpoint configured"
```

---

## Task 3: Enable background TestRunnerService in interactive kiosk

**Files:**
- Modify: `Proxytrace.Application/Module.cs` (lines ~92–104)

This is DI wiring of a hosted-service factory. It mirrors the existing kiosk gates for
`TraceQuotaGuard` and `DemoSeederHostedService`, which the codebase verifies by inspection
(no dedicated unit test — resolving the hosted-service collection in `Proxytrace.Application.Tests`
does not register `KioskOptions` and would require bespoke container plumbing for no real
gain). Verify by build + the full suite staying green.

- [ ] **Step 1: Update the registration**

In `Proxytrace.Application/Module.cs`, replace the TestRunner hosted-service block:

```csharp
        const string testRunnerHostedServiceKey = "Proxytrace.Application.TestRunnerService.Registered";
        if (!builder.Properties.ContainsKey(testRunnerHostedServiceKey))
        {
            builder.Properties[testRunnerHostedServiceKey] = true;
            builder.RegisterServiceCollection(services
                => services.AddSingleton<IHostedService>(sc =>
                {
                    var kiosk = sc.GetRequiredService<KioskOptions>();
                    var endpoint = sc.GetRequiredService<KioskEndpointOptions>();

                    // Disabled only in a read-only kiosk (no LLM endpoint). A configured
                    // endpoint makes kiosk fully interactive, so background test runs execute.
                    return kiosk.Enabled && !endpoint.IsConfigured
                        ? new NullHostedService()
                        : sc.GetRequiredService<TestRunnerService>();
                }));
        }
```

- [ ] **Step 2: Build to verify it compiles**

Run: `dotnet build Proxytrace.Application`
Expected: Build succeeded (`KioskEndpointOptions` is already a registered singleton and
already imported via `using Proxytrace.Application.Demo;`).

- [ ] **Step 3: Run the application test suite**

Run: `dotnet test Proxytrace.Application.Tests`
Expected: PASS (existing TestRunner tests use `RunInForegroundAsync` and are unaffected by
the hosted-service gate).

- [ ] **Step 4: Commit**

```bash
git add Proxytrace.Application/Module.cs
git commit -m "Run background test runner in interactive kiosk"
```

---

## Task 4: Frontend AppConfig `interactive` flag

**Files:**
- Modify: `frontend/src/api/config.ts`

- [ ] **Step 1: Update the type**

Replace the `tracey` field in `frontend/src/api/config.ts`:

```typescript
export interface AppConfig {
  kiosk: boolean;
  /** Full read-write — always true outside kiosk; in kiosk only when an LLM endpoint is configured. */
  interactive: boolean;
}
```

(Leave `configApi.get` unchanged.)

- [ ] **Step 2: Verify the type error surfaces in consumers**

Run: `cd frontend && npx tsc --noEmit`
Expected: errors in `App.tsx` (`appConfig.tracey`) — these are fixed in Task 6.
This confirms the rename is wired through the type system before proceeding.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/config.ts
git commit -m "Rename AppConfig.tracey to interactive"
```

---

## Task 5: KioskContext exposes `interactive`

**Files:**
- Modify: `frontend/src/contexts/KioskContext.tsx`

- [ ] **Step 1: Update the context**

Replace `frontend/src/contexts/KioskContext.tsx` contents:

```typescript
import { createContext, useContext } from 'react';

export interface KioskState {
  enabled: boolean;
  /** Full read-write available — non-kiosk: always; kiosk: only when an LLM endpoint is configured. */
  interactive: boolean;
}

export const KioskContext = createContext<KioskState>({ enabled: false, interactive: true });

export function useKiosk(): KioskState {
  return useContext(KioskContext);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/contexts/KioskContext.tsx
git commit -m "Expose interactive on KioskContext"
```

---

## Task 6: App.tsx wires `interactive` and gates the read-only kill-switch

**Files:**
- Modify: `frontend/src/App.tsx` (`KioskShell` ~184–198, `ModeShell` ~207)

- [ ] **Step 1: Update KioskShell and its call site**

In `frontend/src/App.tsx`, replace the `KioskShell` component:

```tsx
function KioskShell({ interactive }: { interactive: boolean }) {
  useEffect(() => {
    // The `kiosk` body class drives the read-only [data-write] kill-switch (index.css). Only
    // apply it for a read-only kiosk; an interactive kiosk leaves write controls live.
    if (interactive) return;
    document.body.classList.add('kiosk');
    return () => document.body.classList.remove('kiosk');
  }, [interactive]);
  return (
    <KioskContext.Provider value={{ enabled: true, interactive }}>
      <BrowserRouter>
        <CurrentUserContext.Provider value={{ email: 'demo@proxytrace.dev', signOut: () => {} }}>
          <AppRoutes />
        </CurrentUserContext.Provider>
      </BrowserRouter>
    </KioskContext.Provider>
  );
}
```

Then update the call site in `ModeShell`:

```tsx
  if (appConfig?.kiosk) return <KioskShell interactive={!!appConfig.interactive} />;
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: remaining errors only in `Shell.tsx` and `useTraceyChat.ts`
(`traceyAvailable` no longer exists) — fixed in Task 7.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "Wire interactive flag into KioskShell"
```

---

## Task 7: Rename `traceyAvailable` consumers to `interactive`

**Files:**
- Modify: `frontend/src/components/layout/Shell.tsx` (line 133, 192, 277)
- Modify: `frontend/src/features/tracey/useTraceyChat.ts` (line 79, 117, 186)

Behavior is unchanged — the condition (`!kiosk OR endpoint configured`) is identical; this
is a pure rename to the unified flag. Tracey nav/toggle stay hidden in a read-only kiosk
(`interactive === false`).

- [ ] **Step 1: Update Shell.tsx**

In `frontend/src/components/layout/Shell.tsx`:
- Line ~133: change `const { traceyAvailable } = useKiosk();` to
  `const { interactive } = useKiosk();`
- Line ~192: change `.filter(item => !(item.to === '/tracey-ai' && !traceyAvailable))` to
  `.filter(item => !(item.to === '/tracey-ai' && !interactive))`
- Line ~277: change `{traceyAvailable && (` to `{interactive && (`

- [ ] **Step 2: Update useTraceyChat.ts**

In `frontend/src/features/tracey/useTraceyChat.ts`:
- Line ~79: change `const { traceyAvailable } = useKiosk();` to
  `const { interactive } = useKiosk();`
- Line ~117: change `enabled: !!projectId && traceyAvailable && activated,` to
  `enabled: !!projectId && interactive && activated,`
- Line ~186: change `const status: TraceyChat['status'] = !projectId || !traceyAvailable`
  to `const status: TraceyChat['status'] = !projectId || !interactive`

- [ ] **Step 3: Typecheck and build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: no errors; build succeeds.

- [ ] **Step 4: Lint**

Run: `cd frontend && npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/Shell.tsx frontend/src/features/tracey/useTraceyChat.ts
git commit -m "Rename traceyAvailable consumers to interactive"
```

---

## Task 8: Update the manual

**Files:**
- Modify: `manual/admin/configuration.md` (kiosk-mode section)

- [ ] **Step 1: Find the kiosk section**

Run: `grep -n "kiosk\|Kiosk\|Endpoint" manual/admin/configuration.md`
Expected: locate the existing "Kiosk mode" heading and the `Kiosk:Endpoint` description.

- [ ] **Step 2: Document interactive mode**

In the kiosk-mode section of `manual/admin/configuration.md`, add/adjust prose to state:

> By default kiosk mode is a **read-only demo**: visitors can browse seeded data but cannot
> write. Configuring a real LLM endpoint under `Kiosk:Endpoint` (BaseUrl + ApiKey + Model)
> switches kiosk into **interactive mode** — a single-user, in-memory instance with full
> read-write. In interactive mode you can run test suites, run evaluations, generate
> optimization proposals, and create/edit agents, suites, and providers, in addition to
> chatting with Tracey. Data lives only in memory and is lost on restart; interactive kiosk
> is intended for a single user / private demo, not a shared public instance.

Keep wording consistent with the existing page style. If the Tracey availability note on
this page phrases it as "Tracey requires an endpoint", broaden it to "interactive features
require an endpoint" so it is not Tracey-specific.

- [ ] **Step 3: Build the manual**

Run: `cd manual && npm run docs:build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add manual/admin/configuration.md
git commit -m "Document interactive kiosk mode in manual"
```

---

## Task 9: Full verification

- [ ] **Step 1: Backend build + tests**

Run: `dotnet build Proxytrace.sln && dotnet test Proxytrace.Api.Tests Proxytrace.Application.Tests`
Expected: build succeeded; all tests pass.

- [ ] **Step 2: Frontend build + lint + tests**

Run: `cd frontend && npm run build && npm run lint && npm test`
Expected: all green.

- [ ] **Step 3: Confirm no stray `tracey`/`traceyAvailable` config references remain**

Run: `grep -rn "traceyAvailable" frontend/src; grep -rn "\.tracey\b" frontend/src/api frontend/src/App.tsx`
Expected: no matches (the config flag is fully renamed; Tracey *feature* code is untouched).

- [ ] **Step 4: Review**

Per project CLAUDE.md workflow, run the `review` skill over the full diff before declaring
done. Address findings, re-run Step 1–2 if code changes.

---

## Self-Review Notes

- **Spec coverage:** middleware (Task 2), TestRunnerService gate (Task 3), ConfigController
  `interactive` (Task 1), KioskContext (Task 5), App.tsx body-class gate (Task 6),
  consumer rename (Task 7), docs (Task 8). Optimization services / TraceQuotaGuard / auth /
  in-memory DB explicitly unchanged per spec — no tasks, by design.
- **Flag name consistency:** `interactive` used identically across backend JSON, `AppConfig`,
  `KioskState`, and all consumers.
- **No placeholders:** every code step shows full code; every run step shows the command and
  expected outcome.
