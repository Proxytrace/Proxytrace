namespace Proxytrace.Licensing;

/// <summary>
/// Embedded license-signing public keys. The license server signs license JWTs with the
/// corresponding private key; the deployment verifies signatures against these keys.
/// Multiple keys may be active simultaneously to support key rotation.
/// </summary>
public static class LicensePublicKeys
{
    // ECDSA P-256 (ES256) SubjectPublicKeyInfo (SPKI), base64-encoded DER. kid: 2026-05.
    // The license server signs license JWTs with the matching P-256 private key; deployments
    // verify ES256 signatures against this key. Legacy RSA (RS256) keys remain accepted by the
    // validator for backward compatibility (see JwtLicenseValidator.LoadKeys).
    private const string ActivePublicKey =
        "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEeyQtYEJ6RaUJisEAZsCkJ4zHpUS2" +
        "hS4ZBLV1nehbrIsUmSr7gW1qSqT3vBQdQFgwJdKt+Qol0+Ig+RwM29f6hQ==";

    /// <summary>
    /// Returns the currently active set of base64 SPKI public keys.
    /// </summary>
    public static IReadOnlyList<string> GetActiveKeys() => [ActivePublicKey];
}
