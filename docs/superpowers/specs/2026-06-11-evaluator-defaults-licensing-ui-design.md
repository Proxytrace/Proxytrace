# Design — Evaluator Defaults, Agentic License Gating, and UI Tweaks

Date: 2026-06-11
Branch: feature/evaluators_rework

Four independent-but-related changes, shipped as one pass. Two are trivial frontend
tweaks (1, 2); two concern evaluators (3 = auto-provision defaults, 4 = gate agentic
evaluators behind the `AgenticEvaluators` license feature).

---

## Feature 1 — User menu in the title bar

**Today:** `Shell.tsx` renders the avatar as an `IconButton` whose `onClick` calls
`currentUser?.signOut()` directly (line ~290).

**Change:** Wrap the avatar trigger in the existing `Menu` primitive
(`components/ui/Menu.tsx`, Radix dropdown). The avatar `IconButton` becomes the
`Menu` trigger. One item for now: **Logout** (calls `signOut()`).

- Keep `data-testid="logout-btn"` on the **Logout menu item** so existing e2e
  selectors that click logout still work. Add `data-testid="user-menu-trigger"` to
  the avatar trigger.
- Use `Menu.Item` with `onSelect={() => currentUser?.signOut()}`, a logout icon, and
  `danger` styling is optional (keep neutral; logout isn't destructive of data).
- Structured so adding future items (profile, settings) is a one-line addition.

**Test impact:** e2e auth/logout specs click `logout-btn`. With Radix dropdown, the
trigger must be opened first. Update the logout flow in the e2e suite to open the
user menu, then click the `logout-btn` item. Verify which specs reference it before
editing.

## Feature 2 — Test Results: evaluation accordions default collapsed

**Today:** `EvaluatorList` (`runs/drawers/panels/EvaluatorPanel.tsx:69`) passes
`defaultOpen={!ev.pass}` — failing evaluators auto-expand.

**Change:** `defaultOpen={false}` for all. The `EvaluatorPanel` `defaultOpen` prop
stays (still used by the controlled `useState`), just always false from the list.
Update the JSDoc comment on `EvaluatorList` ("failing evaluators expanded by default"
→ "all collapsed by default").

**Test impact:** check e2e/runs specs for assertions that depend on a failing
evaluator's details being visible without a click; adjust to click-to-expand.

## Feature 3 — Auto-create default evaluators per project

**Goal:** Every project has, without manual setup: one **Exact Match** evaluator and
all preset agentic evaluators (currently Helpfulness, Politeness, Safety Classifier,
Tool Usage — whatever `IAgenticEvaluatorPresets.GetAll()` returns). Created on **all
tiers** (free tier sees agentic ones locked per Feature 4; tier can upgrade at runtime
without a backfill step).

**Pattern:** mirror `ITraceyAgentProvisioner` exactly.

New Application-layer service `IDefaultEvaluatorProvisioner`:

```csharp
Task EnsureDefaultEvaluatorsAsync(IProject project, CancellationToken ct = default);
```

Implementation `DefaultEvaluatorProvisioner` (internal, registered in `Module.cs`
like `TraceyAgentProvisioner`). Dependencies mirror `EvaluatorSeedScenario`:
`IAgenticEvaluatorPresets`, `IPromptTemplate.Create`, `IModelParameters.Create`,
`IAgent.CreateNew`, `IAgenticEvaluator.CreateNew`, `IExactMatchEvaluator.CreateNew`,
`IEvaluatorRepository`, `IAgentRepository`.

**Idempotency** (the service is run on create AND on every boot):
- Load existing evaluators via `IEvaluatorRepository.GetByProjectAsync(project.Id)`.
- Exact Match: skip if any `EvaluatorKind.ExactMatch` already exists. Name is fixed
  (`"Exact Match"`).
- Each agentic preset: an agentic evaluator's `Name` equals its agent's name (e.g.
  "Helpfulness"). Skip a preset if an existing agentic evaluator already has that
  name. When creating, reuse an existing system agent of that name if present
  (`IAgentRepository.FindByNameAsync`) before creating a new one — matches Tracey's
  find-then-create and avoids orphan agents.

Agentic creation copies `EvaluatorSeedScenario.SeedFromPreset`: build prompt template
from `preset.SystemPrompt`, create a system agent (`isSystemAgent: true`,
`temperature: 0.0`, `tools: []`, `endpoint: project.SystemEndpoint`), then
`createAgentic(agent)` → `evaluatorRepo.AddAsync`.

**Hook points (mirror Tracey):**
- On project create: `ProjectsController` calls `EnsureDefaultEvaluatorsAsync(saved)`
  right after `EnsureTraceyAgentAsync(saved)` (line ~81).
- On startup backfill: new `DefaultEvaluatorSeederHostedService` (clone of
  `TraceyAgentSeederHostedService`) iterates all projects and ensures defaults.
  Registered as a hosted service in `Module.cs`. Ensures DB ready first via
  `IDatabaseInitializer`, idempotent.

**Note on `EvaluatorSeedScenario`:** it's demo-only seeding and assigns
`ctx.Helpfulness`/`ctx.Politeness` for later demo scenarios. Leave it as-is — it runs
in the demo/kiosk path and overlaps harmlessly (the provisioner is idempotent by
name, so demo seeding and provisioner won't double-create). Confirm no duplicate by
running the provisioner before demo seeding, or rely on name-dedup. (Name-dedup is
already the contract, so order doesn't matter.)

## Feature 4 — Gate agentic evaluators behind the license

`AgenticEvaluators` `LicenseFeature` already exists; `ILicenseService` is the backend
gate; `useLicense()` exposes `features` on the frontend.

### Backend — skip agentic evaluators at run time for unlicensed installs

In `TestRunnerService.RunTestCase` (line ~258), the evaluator loop iterates
`testRun.Group.Suite.Evaluators`. Filter out agentic evaluators when the feature is
disabled:

- Inject `ILicenseService` into `TestRunnerService`.
- Before the `Parallel.ForEachAsync` over evaluators, compute
  `bool agenticEnabled = license.IsFeatureEnabled(LicenseFeature.AgenticEvaluators);`
  and filter: `var evaluators = suite.Evaluators.Where(e => agenticEnabled || e.Kind != EvaluatorKind.Agentic);`
- Skipped agentic evaluators produce **no** evaluation (they're simply not run) — the
  result's pass/fail denominator is over judged evaluators, consistent with how the
  runs view already computes pass rate (see memory: judged-denominator).

`TestRunnerService` is a `BackgroundService` singleton; `ILicenseService.Current` is
always valid and reflects runtime downgrades, so reading it per-run is correct (no
caching needed).

### Frontend — lock agentic evaluators in the suite editor

In `EditSuiteDialog/EvaluatorsPanel.tsx`:

- Read `useLicense()`; `agenticLocked = !features.includes('AgenticEvaluators')`.
- An evaluator row is locked when `agenticLocked && e.kind === 'Agentic'` **and it is
  not already staged** (already-attached agentic evaluators stay removable — decision:
  "Locked, removable").
- Locked, unattached row: disable the toggle button, show a small lock icon
  (`LockIcon` from `components/icons`) in place of / beside the checkbox, dim the row
  (`opacity`), `title="Agentic evaluators require a paid plan"`, and ignore
  `onSelect`/`onToggle` for attaching. A staged agentic row under free tier renders
  normally so it can be unchecked (removed).
- Keep the raw `<button>` eslint exception already present, or route through a ui
  primitive if cleaner; do not introduce new raw controls elsewhere.

The backend `TestSuiteRepository.UpdateRelationsAsync` is the source of truth; the
frontend lock is UX only. We do **not** server-side reject attaching an agentic
evaluator to a suite on free tier — it just won't run (matches "skip at run time").

## Docs & manual

- `docs/licensing.md`: note that `AgenticEvaluators` is enforced at test-run time
  (skipped, not errored) and in the suite editor UI.
- `manual/guide/evaluators.md`: document that exact-match + preset agentic evaluators
  are created automatically per project, and that agentic evaluators require a paid
  plan (locked in the suite editor, skipped during runs on free tier).
- No new `docs/` page or migration needed (no schema change; provisioner is
  Application-layer only).

## Testing

Per `test` skill (backend) and `create-e2e-test` skill (e2e) — invoke them before
writing tests.

- **Backend unit** (`Proxytrace.Application.Tests`): `DefaultEvaluatorProvisioner`
  creates exact-match + all presets; idempotent when called twice; reuses existing
  system agent by name. Mirror `TraceyServiceTests`.
- **Backend** (`TestRunnerService` / Api.Tests): agentic evaluators skipped when
  `AgenticEvaluators` disabled; run when enabled; non-agentic always run.
- **e2e:** update logout flow (open user menu → click Logout). Optionally a spec that
  a new project shows default evaluators on the Evaluators page.

## Out of scope (YAGNI)

- No new preset evaluators beyond what `IAgenticEvaluatorPresets` returns.
- No server-side rejection of agentic-evaluator suite attachment on free tier.
- No additional user-menu items beyond Logout (structure only).
- No reaction to license `Changed` for evaluator provisioning (we always create).
