using System.Reflection;

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
    /// Returns the license-signing public keys this build trusts. A build-time override
    /// (MSBuild property <c>LicensePublicKey</c>, comma-separated base64 SPKI values,
    /// surfaced as Docker build-arg <c>LICENSE_PUBLIC_KEY</c>) replaces the embedded
    /// production key — the e2e/perf stacks use it to bake in the throwaway test key.
    /// The override is compile-time only: a shipped image trusts exactly the keys it was
    /// built with, never a runtime value (see the #if DEBUG guard in the host Modules).
    /// </summary>
    public static IReadOnlyList<string> GetActiveKeys() =>
        ParseOverride(typeof(LicensePublicKeys).Assembly
            .GetCustomAttributes<AssemblyMetadataAttribute>()
            .FirstOrDefault(a => a.Key == "LicensePublicKeyOverride")?.Value);

    /// <summary>
    /// Resolves an override value against the embedded key: null/blank means "no
    /// override" (embedded production key); otherwise a comma-separated key list.
    /// </summary>
    public static IReadOnlyList<string> ParseOverride(string? overrideValue) =>
        string.IsNullOrWhiteSpace(overrideValue)
            ? [ActivePublicKey]
            : overrideValue.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
