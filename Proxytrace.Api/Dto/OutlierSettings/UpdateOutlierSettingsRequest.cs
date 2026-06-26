namespace Proxytrace.Api.Dto.OutlierSettings;

/// <summary>Saves outlier-detection sensitivity.</summary>
public sealed record UpdateOutlierSettingsRequest(
    bool Enabled,
    double SigmaMultiplier,
    int MinSampleCount,
    int SampleWindow);
