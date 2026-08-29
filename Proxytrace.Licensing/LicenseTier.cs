namespace Proxytrace.Licensing;

/// <summary>
/// The support tier a Proxytrace deployment is running under. The member names are the JWT
/// <c>tier</c> claim values and therefore a wire-format contract. Tiers carry no functional
/// entitlements — every feature is always available.
/// </summary>
public enum LicenseTier
{
    /// <summary>No support contract (the default without a key).</summary>
    Free = 0,

    /// <summary>An Enterprise support contract is on file.</summary>
    Enterprise = 100,
}
