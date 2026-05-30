using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.IdentityModel.Tokens;

namespace Proxytrace.Licensing.Tests;

/// <summary>
/// Generates a throwaway RSA keypair and signs license JWTs with it, so validator tests run
/// against a key they control rather than the embedded production placeholder.
/// </summary>
internal sealed class TestLicenseFactory : IDisposable
{
    public const string Issuer = "https://license.proxytrace.dev";
    public const string Audience = "proxytrace";

    private readonly RSA rsa;

    public TestLicenseFactory()
    {
        rsa = RSA.Create(2048);
    }

    /// <summary>
    /// The base64 SPKI public key matching the signing key, for LicensingConfiguration.PublicKeys.
    /// </summary>
    public string PublicKeyBase64 => Convert.ToBase64String(rsa.ExportSubjectPublicKeyInfo());

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

        var signingKey = new RsaSecurityKey(sign ? rsa : RSA.Create(2048));
        var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.RsaSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            notBefore: DateTime.UtcNow.AddMinutes(-5),
            expires: (expires ?? DateTimeOffset.UtcNow.AddDays(365)).UtcDateTime,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public void Dispose() => rsa.Dispose();
}
