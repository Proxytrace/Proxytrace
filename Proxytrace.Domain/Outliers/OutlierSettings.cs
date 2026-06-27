namespace Proxytrace.Domain.Outliers;

/// <summary>
/// Operator-tunable sensitivity for ingestion-time outlier detection. A single instance per
/// installation. When no row has been saved, <see cref="Default"/> applies.
/// </summary>
/// <param name="Enabled">Master switch; when off no call is flagged.</param>
/// <param name="SigmaMultiplier">How many standard deviations from the agent's recent mean a metric
/// must deviate before the call is flagged (the <c>N</c> in mean ± N·stddev).</param>
/// <param name="MinSampleCount">Minimum recent samples a metric needs before it is evaluated — guards
/// the cold start, where a handful of calls give an unstable baseline.</param>
/// <param name="SampleWindow">How many of the agent's most recent successful calls form the baseline.</param>
public sealed record OutlierSettings(
    bool Enabled,
    double SigmaMultiplier,
    int MinSampleCount,
    int SampleWindow)
{
    /// <summary>Defaults applied when the operator has not saved any settings.</summary>
    public static OutlierSettings Default { get; } = new(
        Enabled: true,
        SigmaMultiplier: 3.0,
        MinSampleCount: 30,
        SampleWindow: 200);
}
