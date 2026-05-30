using Microsoft.Extensions.Logging;
using Proxytrace.Licensing.Exceptions;

namespace Proxytrace.Licensing.Internal;

/// <summary>
/// The authoritative <see cref="ILicenseService"/>. Performs the synchronous startup gate in its
/// constructor: with no JWT it runs Free; with a valid JWT it activates; with an invalid JWT it
/// throws <see cref="InvalidLicenseException"/>, which (via AutoActivate) fails container build
/// and crashes the host non-zero.
/// </summary>
internal sealed class LicenseService : ILicenseService
{
    private readonly Func<ILicenseRefreshTrigger> refreshTrigger;
    private readonly ILogger<LicenseService> logger;
    private readonly object gate = new();

    private volatile LicenseSnapshot current;

    public LicenseService(
        LicensingConfiguration configuration,
        IJwtLicenseValidator validator,
        Func<ILicenseRefreshTrigger> refreshTrigger,
        ILogger<LicenseService> logger)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentNullException.ThrowIfNull(validator);
        this.refreshTrigger = refreshTrigger;
        this.logger = logger;

        var jwt = configuration.LicenseJwt?.Trim();
        if (string.IsNullOrEmpty(jwt))
        {
            logger.LogInformation("No license configured; running in Free tier");
            current = LicenseSnapshot.Free();
        }
        else
        {
            // Throws InvalidLicenseException on a bad JWT — intentionally propagates out of
            // container build so an operator misconfiguration fails fast.
            current = validator.Validate(jwt);
            logger.LogInformation(
                "License validated: tier {Tier}, customer {Customer}",
                current.Tier,
                current.CustomerEmail);
        }
    }

    public LicenseSnapshot Current => current;

    public event Action? Changed;

    public bool IsFeatureEnabled(LicenseFeature feature) => current.Features.Contains(feature);

    public long GetLimit(LicenseLimit limit)
        => current.Limits.TryGetValue(limit, out var value) ? value : 0;

    public Task ForceRefreshAsync(CancellationToken cancellationToken = default)
        => refreshTrigger().RunCheckNowAsync(cancellationToken);

    /// <summary>
    /// Replaces the current snapshot and raises <see cref="Changed"/> when it actually changed.
    /// Invoked by the background check service as the license state machine transitions.
    /// </summary>
    public void ApplySnapshot(LicenseSnapshot snapshot)
    {
        ArgumentNullException.ThrowIfNull(snapshot);

        bool changed;
        lock (gate)
        {
            changed = !Equals(current, snapshot);
            current = snapshot;
        }

        if (changed)
        {
            logger.LogInformation(
                "License snapshot updated: tier {Tier}, status {Status}",
                snapshot.Tier,
                snapshot.Status);
            Changed?.Invoke();
        }
    }
}
