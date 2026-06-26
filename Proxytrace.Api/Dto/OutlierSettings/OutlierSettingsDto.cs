namespace Proxytrace.Api.Dto.OutlierSettings;

/// <summary>Outlier-detection sensitivity for the admin UI.</summary>
public sealed record OutlierSettingsDto(
    bool Enabled,
    double SigmaMultiplier,
    int MinSampleCount,
    int SampleWindow);
