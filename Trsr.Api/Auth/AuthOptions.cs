namespace Trsr.Api.Auth;

internal sealed class AuthOptions
{
    public const string SectionName = "Authentication";

    public OidcOptions Oidc { get; init; } = new();
    public LocalSection Local { get; init; } = new();

    public AuthMode Mode => string.IsNullOrWhiteSpace(Oidc.Authority) ? AuthMode.Local : AuthMode.Oidc;

    internal sealed class OidcOptions
    {
        public string Authority { get; init; } = string.Empty;
        public string Audience { get; init; } = string.Empty;
        public bool RequireHttpsMetadata { get; init; } = true;
        public string EmailClaimType { get; init; } = "email";
        public string NameClaimType { get; init; } = "name";
    }

    internal sealed class LocalSection
    {
        public string SigningKey { get; init; } = string.Empty;
    }
}
