namespace Proxytrace.Api.Auth;

/// <summary>
/// The local-mode session cookie. The session JWT is issued as an httpOnly cookie so the
/// SPA never has to persist it in script-readable storage (localStorage XSS hardening);
/// <c>SameSite=Strict</c> plus the API's JSON-only request bodies cover CSRF. The token is
/// also returned in the response body for non-browser API clients, which keep using the
/// Authorization header. <see cref="JwtBearerEventsFactory"/> falls back to this cookie
/// when no bearer token is present.
/// </summary>
internal static class SessionCookie
{
    public const string Name = "proxytrace_session";

    public static void Append(HttpResponse response, string token, DateTimeOffset expiresAt) =>
        response.Cookies.Append(Name, token, new CookieOptions
        {
            HttpOnly = true,
            Secure = response.HttpContext.Request.IsHttps,
            SameSite = SameSiteMode.Strict,
            Path = "/",
            Expires = expiresAt,
        });

    public static void Delete(HttpResponse response) =>
        response.Cookies.Delete(Name, new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Strict,
            Path = "/",
        });
}
