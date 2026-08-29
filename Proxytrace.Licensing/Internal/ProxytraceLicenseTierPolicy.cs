using Core = Nordstein.Core.Licensing;

namespace Proxytrace.Licensing.Internal;

/// <summary>
/// Supplies Proxytrace's licensing vocabulary to the Nordstein.Core licensing engine. The
/// canonical tier names are the enum member names of <see cref="LicenseTier"/> — which are also
/// the JWT <c>tier</c> claim values the license server signs, so they are a wire-format contract
/// and must not change. Proxytrace grants every feature to every deployment, so the vocabulary
/// has no features or limits: <c>feat</c>/<c>lim</c> claims on legacy keys are ignored by the
/// engine (with a warning) rather than rejected.
/// </summary>
internal sealed class ProxytraceLicenseTierPolicy : Core.ILicenseTierPolicy
{
    private static readonly Core.TierDefinition Empty = new(
        new HashSet<string>(),
        new Dictionary<string, long>());

    /// <summary>
    /// Gets the fallback tier.
    /// </summary>
    public string FallbackTier => nameof(LicenseTier.Free);

    /// <summary>
    /// Every tier grants the same (empty) entitlement set — the tier only names a support level.
    /// </summary>
    public Core.TierDefinition GetDefinition(string tier) => Empty;

    /// <summary>
    /// Tries to resolve the tier.
    /// </summary>
    public bool TryResolveTier(string? value, out string tier)
    {
        // Numeric strings parse as undefined enum values, so require a defined member — the
        // canonical spelling is the member name, matched case-insensitively.
        if (Enum.TryParse<LicenseTier>(value, ignoreCase: true, out var parsed)
            && Enum.IsDefined(parsed))
        {
            tier = parsed.ToString();
            return true;
        }

        tier = string.Empty;
        return false;
    }

    /// <summary>
    /// Proxytrace has no feature vocabulary; every value is unknown.
    /// </summary>
    public bool TryResolveFeature(string value, out string feature)
    {
        feature = string.Empty;
        return false;
    }

    /// <summary>
    /// Proxytrace has no limit vocabulary; every value is unknown.
    /// </summary>
    public bool TryResolveLimit(string value, out string limit)
    {
        limit = string.Empty;
        return false;
    }
}
