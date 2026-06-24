using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.IdentityModel.Tokens;

namespace Proxytrace.Licensing.Tests;

/// <summary>
/// Generates a throwaway keypair and signs license JWTs with it, so validator tests run against a
/// key they control rather than the embedded production placeholder. Defaults to ES256 (P-256) to
/// match the active embedded key; pass <c>useEcdsa: false</c> to exercise the legacy RS256 path.
/// </summary>
internal sealed class TestLicenseFactory : IDisposable
{
    public const string Issuer = "https://license.proxytrace.dev";
    public const string Audience = "proxytrace";

    private readonly RSA? rsa;
    private readonly ECDsa? ecdsa;

    public TestLicenseFactory(bool useEcdsa = true)
    {
        if (useEcdsa)
            ecdsa = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        else
            rsa = RSA.Create(2048);
    }

    private AsymmetricAlgorithm Key => (AsymmetricAlgorithm?)ecdsa ?? rsa ?? throw new InvalidOperationException("No key generated");

    private SecurityKey SigningSecurityKey => ecdsa is not null
        ? new ECDsaSecurityKey(ecdsa)
        : new RsaSecurityKey(rsa);

    private string Algorithm => ecdsa is not null
        ? SecurityAlgorithms.EcdsaSha256
        : SecurityAlgorithms.RsaSha256;

    private SecurityKey UntrustedKey => ecdsa is not null
        ? new ECDsaSecurityKey(ECDsa.Create(ECCurve.NamedCurves.nistP256))
        : new RsaSecurityKey(RSA.Create(2048));

    /// <summary>
    /// The base64 SPKI public key matching the signing key, for LicensingConfiguration.PublicKeys.
    /// </summary>
    public string PublicKeyBase64 => Convert.ToBase64String(Key.ExportSubjectPublicKeyInfo());

    public LicensingConfiguration Configuration(string? jwt = null) => new()
    {
        ServerUrl = "https://license.proxytrace.dev",
        PublicKeys = [PublicKeyBase64],
        LicenseJwt = jwt,
        CheckIntervalHours = 24,
        OfflineGracePeriodDays = 7,
        CacheFilePath = Path.Combine(Path.GetTempPath(), $"license-cache-{Guid.NewGuid():N}.json"),
    };

    public string CreateJwt(
        string tier = "Enterprise",
        string? issuer = Issuer,
        string? audience = Audience,
        DateTimeOffset? expires = null,
        string subject = "customer@example.com",
        string? jti = null,
        IEnumerable<string>? features = null,
        IEnumerable<string>? limits = null,
        bool? offline = null,
        (string Value, string ValueType)? offlineRaw = null,
        bool sign = true)
    {
        var claims = new List<Claim>
        {
            new("tier", tier),
            new(JwtRegisteredClaimNames.Sub, subject),
            new(JwtRegisteredClaimNames.Jti, jti ?? Guid.NewGuid().ToString("N")),
        };

        foreach (var feature in features ?? [])
            claims.Add(new Claim("feat", feature));

        foreach (var limit in limits ?? [])
            claims.Add(new Claim("lim", limit));

        // Emitted as a real JSON boolean (ClaimValueTypes.Boolean) to mirror the license server's
        // wire format — `offline: true` for an offline-only key, `offline: false` defensively.
        // Pass null to omit the claim entirely (a normal online license). `offlineRaw` injects an
        // off-contract claim of a chosen JSON type (e.g. a string or number) to exercise the
        // validator's strict type-matching.
        if (offline is { } offlineValue)
            claims.Add(new Claim("offline", offlineValue ? "true" : "false", ClaimValueTypes.Boolean));
        else if (offlineRaw is { } raw)
            claims.Add(new Claim("offline", raw.Value, raw.ValueType));

        var signingKey = sign ? SigningSecurityKey : UntrustedKey;
        var credentials = new SigningCredentials(signingKey, Algorithm);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            notBefore: DateTime.UtcNow.AddMinutes(-5),
            expires: (expires ?? DateTimeOffset.UtcNow.AddDays(365)).UtcDateTime,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public void Dispose()
    {
        rsa?.Dispose();
        ecdsa?.Dispose();
    }
}
