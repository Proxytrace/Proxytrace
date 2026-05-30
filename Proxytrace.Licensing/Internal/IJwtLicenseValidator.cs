namespace Proxytrace.Licensing.Internal;

/// <summary>
/// Validates and parses a license JWT into a <see cref="LicenseSnapshot"/>. Pure: no network.
/// </summary>
internal interface IJwtLicenseValidator
{
    /// <summary>
    /// Validates the signature, issuer, audience, and lifetime of the JWT and projects its claims
    /// onto a license snapshot. Throws <see cref="Exceptions.InvalidLicenseException"/> on failure.
    /// </summary>
    LicenseSnapshot Validate(string jwt);
}
