namespace Trsr.Api.Auth;

/// <summary>
/// Configuration bound from the <c>Authentication:Oidc</c> section in <c>appsettings.json</c>.
/// </summary>
internal sealed class AuthOptions
{
    public const string SectionName = "Authentication:Oidc";

    /// <summary>OIDC issuer URL (e.g. <c>https://idp.example.com/realms/trsr</c>).</summary>
    public string Authority { get; init; } = string.Empty;

    /// <summary>Expected <c>aud</c> claim value for access tokens issued to this API.</summary>
    public string Audience { get; init; } = string.Empty;

    /// <summary>Require HTTPS for the IdP metadata endpoint. Disable only in development.</summary>
    public bool RequireHttpsMetadata { get; init; } = true;

    /// <summary>Claim type used to read the user's email. Defaults to <c>"email"</c>.</summary>
    public string EmailClaimType { get; init; } = "email";

    /// <summary>Claim type used to read the user's display name. Defaults to <c>"name"</c>.</summary>
    public string NameClaimType { get; init; } = "name";
}
