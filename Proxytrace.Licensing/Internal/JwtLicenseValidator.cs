using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using Proxytrace.Licensing.Exceptions;

namespace Proxytrace.Licensing.Internal;

/// <summary>
/// RS256 license JWT validator. Verifies signatures against the configured SPKI public keys and
/// projects the <c>tier</c>, <c>feat</c>, and <c>lim</c> claims onto a <see cref="LicenseSnapshot"/>.
/// </summary>
internal sealed class JwtLicenseValidator : IJwtLicenseValidator
{
    private const string Issuer = "https://license.proxytrace.dev";
    private const string Audience = "proxytrace";

    private readonly IReadOnlyList<SecurityKey> signingKeys;
    private readonly ILogger<JwtLicenseValidator> logger;

    public JwtLicenseValidator(LicensingConfiguration configuration, ILogger<JwtLicenseValidator> logger)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        this.logger = logger;
        this.signingKeys = LoadKeys(configuration.PublicKeys);
    }

    public LicenseSnapshot Validate(string jwt)
    {
        if (string.IsNullOrWhiteSpace(jwt))
            throw new InvalidLicenseException(InvalidLicenseReason.Malformed);

        var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };

        var parameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = Issuer,
            ValidateAudience = true,
            ValidAudience = Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKeys = signingKeys,
            ValidateLifetime = true,
            ValidAlgorithms = [SecurityAlgorithms.RsaSha256],
            ClockSkew = TimeSpan.Zero,
        };

        JwtSecurityToken token;
        try
        {
            handler.ValidateToken(jwt, parameters, out var validated);
            token = (JwtSecurityToken)validated;
        }
        catch (SecurityTokenExpiredException ex)
        {
            throw new InvalidLicenseException(InvalidLicenseReason.Expired, ex.Message, ex);
        }
        catch (SecurityTokenInvalidIssuerException ex)
        {
            throw new InvalidLicenseException(InvalidLicenseReason.WrongIssuer, ex.Message, ex);
        }
        catch (SecurityTokenInvalidAudienceException ex)
        {
            throw new InvalidLicenseException(InvalidLicenseReason.WrongAudience, ex.Message, ex);
        }
        catch (SecurityTokenSignatureKeyNotFoundException ex)
        {
            throw new InvalidLicenseException(InvalidLicenseReason.BadSignature, ex.Message, ex);
        }
        catch (SecurityTokenInvalidSignatureException ex)
        {
            throw new InvalidLicenseException(InvalidLicenseReason.BadSignature, ex.Message, ex);
        }
        catch (Exception ex) when (ex is SecurityTokenException or ArgumentException)
        {
            throw new InvalidLicenseException(InvalidLicenseReason.Malformed, ex.Message, ex);
        }

        return BuildSnapshot(token);
    }

    private LicenseSnapshot BuildSnapshot(JwtSecurityToken token)
    {
        var tier = ParseTier(token);
        var definition = LicensePolicy.For(tier);

        var features = new HashSet<LicenseFeature>(definition.Features);
        foreach (var claim in token.Claims.Where(c => c.Type == "feat"))
        {
            if (Enum.TryParse<LicenseFeature>(claim.Value, ignoreCase: true, out var feature))
                features.Add(feature);
            else
                logger.LogWarning("Ignoring unknown license feature claim '{Feature}'", claim.Value);
        }

        var limits = new Dictionary<LicenseLimit, long>(definition.Limits);
        foreach (var claim in token.Claims.Where(c => c.Type == "lim"))
        {
            // Encoded as "Name=Value", e.g. "MaxUsers=50".
            var separator = claim.Value.IndexOf('=');
            if (separator <= 0)
            {
                logger.LogWarning("Ignoring malformed license limit claim '{Limit}'", claim.Value);
                continue;
            }

            var name = claim.Value[..separator];
            var rawValue = claim.Value[(separator + 1)..];
            if (Enum.TryParse<LicenseLimit>(name, ignoreCase: true, out var limit)
                && long.TryParse(rawValue, out var value))
            {
                limits[limit] = value;
            }
            else
            {
                logger.LogWarning("Ignoring unparseable license limit claim '{Limit}'", claim.Value);
            }
        }

        DateTimeOffset? expiresAt = token.Payload.Expiration is { } exp
            ? DateTimeOffset.FromUnixTimeSeconds(exp)
            : null;

        var email = token.Subject;

        return new LicenseSnapshot(
            tier,
            LicenseStatus.Active,
            expiresAt,
            GracePeriodEndsAt: null,
            CustomerEmail: string.IsNullOrWhiteSpace(email) ? null : email,
            Jti: token.Id,
            features,
            limits);
    }

    private LicenseTier ParseTier(JwtSecurityToken token)
    {
        var raw = token.Claims.FirstOrDefault(c => c.Type == "tier")?.Value;
        if (Enum.TryParse<LicenseTier>(raw, ignoreCase: true, out var tier))
            return tier;

        logger.LogWarning("Unknown license tier '{Tier}'; falling back to Free", raw);
        return LicenseTier.Free;
    }

    private static IReadOnlyList<SecurityKey> LoadKeys(IReadOnlyList<string> base64SpkiKeys)
    {
        var keys = new List<SecurityKey>();
        foreach (var encoded in base64SpkiKeys)
        {
            if (string.IsNullOrWhiteSpace(encoded))
                continue;

            var der = Convert.FromBase64String(encoded.Trim());
            var rsa = RSA.Create();
            rsa.ImportSubjectPublicKeyInfo(der, out _);
            keys.Add(new RsaSecurityKey(rsa));
        }

        return keys;
    }
}
