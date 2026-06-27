namespace Proxytrace.Application.Auth;

public sealed class AuthOptions
{
    public OidcOptions Oidc { get; init; } = new();
    public LocalSection Local { get; init; } = new();

    /// <summary>
    /// Emergency break-glass switch (default <see langword="false"/>). When email delivery is
    /// unavailable, the self-service password reset normally logs only a REDACTED warning — a
    /// non-reversible token hint and the expiry, never the live link. Set this to
    /// <see langword="true"/> to instead log the full one-time reset URL so a locked-out sole admin can
    /// recover when SMTP is down. Anyone able to read the operator log within the token's 1-hour TTL can
    /// then take over the account, so leave it off except while actively recovering. See docs/security.md.
    /// </summary>
    public bool EmergencyLogResetLink { get; init; }

    public AuthMode Mode
        => string.IsNullOrWhiteSpace(Oidc.Authority)
            ? AuthMode.Local 
            : AuthMode.Oidc;

    public sealed class OidcOptions
    {
        public string Authority { get; init; } = string.Empty;
        public string Audience { get; init; } = string.Empty;
        public bool RequireHttpsMetadata { get; init; } = true;
        public string EmailClaimType { get; init; } = "email";
        public string NameClaimType { get; init; } = "name";
    }

    public sealed class LocalSection
    {
        public string SigningKey { get; init; } = string.Empty;
    }
}
