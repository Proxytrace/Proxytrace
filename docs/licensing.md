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
  `OptimizationProposals`, `AgenticEvaluators`, `CustomEvaluators`, `SsoOidc`, `AuditLog`.
- **`Current` is never null** and defaults to the **Free** tier — write code that degrades to Free,
  never code that assumes a paid tier or null-guards the snapshot.
- **Treat `long.MaxValue` from `GetLimit` as unlimited** — do not cap or special-case it elsewhere.
- **React to `Changed`** for long-lived state: the tier can be downgraded at runtime by a background
  license-server check, so cached feature decisions must be invalidated.
- License tokens are **JWT, verified against bundled public keys** (`LicensePublicKeys`). Never trust
  an unverified tier value; always go through the service.
- When adding a new gated capability, add a `LicenseFeature`/`LicenseLimit` member and assign it to
  the right `TierDefinition` rather than checking the tier enum directly at the call site.
