namespace Proxytrace.Storage.Internal.Entities.OutlierSettings;

/// <summary>The single-row outlier-detection sensitivity configuration.</summary>
internal record OutlierSettingsEntity : Entity
{
    public required bool Enabled { get; init; }
    public required double SigmaMultiplier { get; init; }
    public required int MinSampleCount { get; init; }
    public required int SampleWindow { get; init; }
}
