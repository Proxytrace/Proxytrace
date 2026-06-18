# Licensing

`Proxytrace.Licensing` gates product capabilities behind license tiers. `ILicenseService` is the
**single source of truth** for licensing decisions across the application — never hard-code tier
checks or duplicate gating logic elsewhere.

```csharp
public interface ILicenseService
{
    LicenseSnapshot Current { get; }            // never null; defaults to Free
    event Action Changed;                       // fires when the tier changes (e.g. background downgrade)
    bool IsFeatureEnabled(LicenseFeature feature);
    long GetLimit(LicenseLimit limit);          // long.MaxValue == unlimited
    Task ForceRefreshAsync(CancellationToken cancellationToken = default);
}
```

## Directives

- **Gate every premium capability through `ILicenseService`.** Before exposing or executing a gated
  feature, check `IsFeatureEnabled(...)` / `GetLimit(...)`. Current gated features:
  `OptimizationProposals`, `AgenticEvaluators`, `CustomEvaluators`, `SsoOidc`, `AuditLog`, `Tracey`,
  `ScheduledTestRuns`.
- **`Current` is never null** and defaults to the **Free** tier — write code that degrades to Free,
  never code that assumes a paid tier or null-guards the snapshot.
- **Treat `long.MaxValue` from `GetLimit` as unlimited** — do not cap or special-case it elsewhere.
- **React to `Changed`** for long-lived state: the tier can change at runtime — downgraded by a
  background license-server check, or **replaced entirely** when an admin sets/removes a license
  key in the UI — so cached feature decisions must be invalidated.
- License tokens are **JWT, verified against bundled public keys** (`LicensePublicKeys`). Never trust
  an unverified tier value; always go through the service.
- When adding a new gated capability, add a `LicenseFeature`/`LicenseLimit` member and assign it to
  the right `TierDefinition` rather than checking the tier enum directly at the call site.

## Runtime license management (set/remove without restart)

The effective license resolves in this precedence order: **database-stored key → environment JWT
(`PROXYTRACE_LICENSE` / `Licensing:License`) → Free**. Kiosk's `OverrideSnapshot` short-circuits
everything and is not user-manageable.

- `LicenseSnapshot` carries a `Source` (`None`/`Environment`/`Stored`/`Override`) and, when a
  configured key fails validation, `Status = Invalid` + `InvalidReason` with **Free entitlements**.
  An invalid license **never crashes the host** (the old fail-fast startup gate is gone); the UI
  surfaces a banner instead.
- `ILicenseActivator` (`Proxytrace.Licensing`) — validation + snapshot swap:
  `Validate` (dry run, throws `InvalidLicenseException`), `Activate` (throws; current license kept
  on rejection), `ActivateOrInvalid` (never throws — applies an Invalid snapshot), and
  `ActivateConfigured` (re-resolves override/env/Free; used on remove).
- `ILicenseKeyManager` (`Proxytrace.Application.Licensing`) — orchestrates persistence:
  `SetAsync` validates → persists via `IStoredLicenseStore` (single-row `StoredLicenseEntity` in
  Storage) → activates as `Stored`; `RemoveAsync` deletes and falls back via `ActivateConfigured`.
- `StoredLicenseStartupService` (Application hosted service, registered **after** the database
  initializer) applies the stored key once migrations have run. Failures are logged, never fatal.
- `LicenseCheckService` reacts to `Changed` — a license activated at runtime starts revocation
  checks; it no longer latches onto the startup snapshot.
- API: `GET /api/license` (anonymous; includes `source`/`invalidReason`),
  `POST /api/license/validate` (anonymous dry run), `PUT /api/license` (admin, **or anonymous while
  no users exist** — the setup wizard's gate), `DELETE /api/license` (admin),
  `POST /api/license/refresh` (admin). Manage endpoints 409 under a kiosk override.
- The license offline-grace cache and the auto-generated signing key live in
  `PROXYTRACE_DATA_DIR` when set (the Docker deployment mounts the `appdata` volume there).

## Notes on specific gates

- **`AgenticEvaluators`** is enforced at *use* time, not creation time. Default agentic evaluators
  are provisioned for every project regardless of tier (`IDefaultEvaluatorProvisioner`); the gate
  applies in two places: (1) `TestRunnerService` skips agentic evaluators during a run when the
  feature is disabled — they are silently not run, never errored, so the pass rate is computed over
  judged evaluators; (2) the suite editor (`EvaluatorsPanel`) locks unattached agentic evaluators on
  the frontend. An agentic evaluator attached while licensed simply stops running after a downgrade.
- **`ScheduledTestRuns`** (Enterprise) is enforced both at *creation* and at *use*. The
  `TestRunSchedulesController` decorates create/update/delete/run-now with
  `[RequiresFeature(LicenseFeature.ScheduledTestRuns)]` (returns **402** when unlicensed); listing
  stays ungated so existing schedules remain visible. At use time `TestRunSchedulerService` skips
  unlicensed schedules without deleting them, so a downgrade pauses scheduled runs and a re-upgrade
  resumes them — the feature degrades gracefully rather than destroying configuration.
