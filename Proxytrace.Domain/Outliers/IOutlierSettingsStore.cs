namespace Proxytrace.Domain.Outliers;

/// <summary>
/// Persistence for the single-row outlier-detection sensitivity configuration. At most one row
/// exists; <see cref="GetAsync"/> returns null when none has been saved (callers fall back to
/// <see cref="OutlierSettings.Default"/>).
/// </summary>
public interface IOutlierSettingsStore
{
    Task<OutlierSettings?> GetAsync(CancellationToken cancellationToken = default);

    /// <summary>Persists the settings, replacing any previously stored row.</summary>
    Task SaveAsync(OutlierSettings settings, CancellationToken cancellationToken = default);
}
