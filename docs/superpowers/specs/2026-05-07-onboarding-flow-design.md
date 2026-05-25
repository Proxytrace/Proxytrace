# Onboarding Flow Design

**Date:** 2026-05-07  
**Status:** Approved

## Context

Proxytrace has no first-run experience. A new installation exposes a full app shell with empty state, no admin user, no provider, and no API key — nothing works out of the box. This design adds a guided 5-step onboarding wizard that initializes a fresh installation and leaves users with a working proxy endpoint they can immediately point their LLM clients at.

## Architecture

### Backend — SetupController

One new controller: `Proxytrace.Api/Controllers/SetupController.cs`

- `GET /api/setup/status` → `{ isConfigured: bool }`
  - Resolves `IRepository<IUser>` and calls `GetAllAsync(ct)` (or count query)
  - Returns `isConfigured: true` if any user exists
  - No auth required (unauthenticated endpoint, needed before any user exists)

New DTO: `Proxytrace.Api/Dto/Setup/SetupStatusDto.cs`
```csharp
public record SetupStatusDto
{
    public required bool IsConfigured { get; init; }
}
```

No other backend changes. All 5 step operations use existing endpoints.

### Frontend — /setup Route

New files:
- `frontend/src/features/setup/Setup.tsx` — full-page wizard component
- `frontend/src/api/setup.ts` — `setupApi.getStatus()` → `SetupStatusDto`

**Routing changes in `App.tsx`:**
- Add lazy import for `Setup`
- Add `/setup` route **outside** the `Shell` wrapper (no sidebar)
- On app load, React Query fetches `/api/setup/status`; if `!isConfigured`, navigate to `/setup`
- If `isConfigured` and user lands on `/setup`, redirect to `/dashboard`

**State shape in Setup.tsx:**
```typescript
interface SetupState {
  userId: string | null;
  providerId: string | null;
  endpointId: string | null;
  projectId: string | null;
  apiKeyValue: string | null;
}
```

## Step-by-Step Design

Wizard uses the existing `StepWizard` component (`src/components/overlays/StepWizard.tsx`).  
`canAdvance` is `false` until the step's API call succeeds.  
`loading` is `true` while the call is in flight.

| # | Label | Fields | API Call | State updated |
|---|-------|--------|----------|---------------|
| 1 | Welcome & Admin User | Name (text) | `POST /api/users` | `userId` |
| 2 | Configure Provider | Name, Endpoint URL, Upstream API Key, Kind (select) | `POST /api/providers` | `providerId` |
| 3 | Configure Model | Model name (free text), Input cost per 1M tokens, Output cost per 1M tokens | `POST /api/providers/{providerId}/models` | `endpointId` |
| 4 | Create Project | Name | `POST /api/projects` (`systemEndpointId = endpointId`) | `projectId` |
| 5 | API Key & Proxy Setup | Key name (pre-filled "default") | `POST /api/providers/{providerId}/keys` (`projectId`) | `apiKeyValue` |

### Step 1 — Welcome & Admin User

- Hero welcome message explaining Proxytrace
- `FormField label="Your name"` → `<input>` with `formInputCls`
- On Next: `POST /api/users { name }` → `userId`

### Step 2 — Configure Provider

- Fields: Name, Endpoint URL (e.g. `https://api.anthropic.com/v1`), Upstream API Key, Kind
- Kind rendered as `<select>` with options: Anthropic, OpenAI, OpenAI Compatible
- On Next: `POST /api/providers` → `providerId`

### Step 3 — Configure Model

- Fields: Model name (free text, e.g. `claude-sonnet-4-5`), Input token cost (optional decimal), Output token cost (optional decimal)
- On Next: `POST /api/providers/{providerId}/models` → `endpointId`

### Step 4 — Create Project

- Single field: Project Name
- On Next: `POST /api/projects { name, systemEndpointId: endpointId }` → `projectId`

### Step 5 — API Key & Proxy Instructions

- Key name field (pre-filled "default"), editable
- On submit ("Finish"): `POST /api/providers/{providerId}/keys { name, projectId }` → `apiKeyValue`
- After success, the wizard body replaces with:
  - `<CodeBlock>` showing the generated key (prominent, with copy button)
  - Usage example in a `<CodeBlock>`:
    ```
    POST http://localhost:5001/openai/v1/chat/completions
    Authorization: Bearer <apiKeyValue>
    Content-Type: application/json
    ```
  - Brief explanation: "Point any OpenAI-compatible client at this endpoint with your Proxytrace key."
- "Go to Traces" button → `navigate('/traces')`

## Error Handling

- Per-step API errors displayed via `FormField error` prop (inline beneath the field)
- Unexpected errors (network, 500) shown via `useToast().show(msg, 'error')`
- `canAdvance` stays `false` on error — user retries in place
- Back navigation is allowed on steps 2–5; does **not** undo the already-submitted step
- Previous step inputs shown read-only for reference when navigating back (display-only, not re-submittable)

## Routing Guard

`App.tsx` setup check:
```typescript
const { data: setupStatus } = useQuery({
  queryKey: ['setup-status'],
  queryFn: setupApi.getStatus,
  staleTime: Infinity,  // only check once per session
});

// In route rendering:
// if (!setupStatus?.isConfigured) → <Navigate to="/setup" />
// if on /setup and isConfigured → <Navigate to="/dashboard" />
```

`staleTime: Infinity` so the check doesn't re-fire on every navigation. The query is **not** invalidated mid-wizard — `isConfigured` stays `false` for the lifetime of the session, preventing the guard from redirecting the user away while they complete steps. On the next app load (after `/traces` redirect), the fresh check returns `isConfigured: true` and the user is never sent back to `/setup`.

## Testing

### Backend
- `Proxytrace.Api.Tests/Controllers/SetupControllerTests.cs`
- Test: `GetStatus_WhenNoUsersExist_ReturnsNotConfigured`
- Test: `GetStatus_AfterUserCreated_ReturnsConfigured`

### Frontend
- `frontend/src/features/setup/Setup.spec.ts`
- Test: `canAdvance is false until step API call resolves`
- Test: `navigates to /traces after step 5 completes`
- Test: `redirects to /dashboard if setup already complete`

## Files to Create/Modify

**New files:**
- `Proxytrace.Api/Controllers/SetupController.cs`
- `Proxytrace.Api/Dto/Setup/SetupStatusDto.cs`
- `Proxytrace.Api.Tests/Controllers/SetupControllerTests.cs`
- `frontend/src/api/setup.ts`
- `frontend/src/features/setup/Setup.tsx`
- `frontend/src/features/setup/Setup.spec.ts`

**Modified files:**
- `frontend/src/App.tsx` — add `/setup` route + setup status guard

## Verification

1. `dotnet build Proxytrace.sln` — no errors
2. `dotnet test Proxytrace.sln` — all tests pass including new `SetupControllerTests`
3. `./dev.sh` — open `http://localhost:4201`; verify redirect to `/setup` on fresh DB
4. Complete all 5 steps; verify redirect to `/traces` after finish
5. Reload app; verify redirect to `/dashboard` (not `/setup`) since setup is now complete
6. `npm test` in `frontend/` — `Setup.spec.ts` passes
