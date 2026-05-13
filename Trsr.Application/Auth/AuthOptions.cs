namespace Trsr.Application.Auth;

public sealed class AuthOptions
{
    public OidcOptions Oidc { get; init; } = new();
    public LocalSection Local { get; init; } = new();

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
