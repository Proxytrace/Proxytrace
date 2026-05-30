namespace Proxytrace.Licensing;

/// <summary>
/// The feature set and limits granted by a particular license tier.
/// </summary>
public sealed record TierDefinition(
    IReadOnlySet<LicenseFeature> Features,
    IReadOnlyDictionary<LicenseLimit, long> Limits);
