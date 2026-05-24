namespace Trsr.Api.Middleware;

/// <summary>
/// Adds security headers to every response. Matters most for the SPA the API serves
/// from wwwroot (the nginx deployment sets equivalent headers in nginx.conf). The CSP
/// mirrors frontend/index.html's build-time meta so both serve paths are consistent.
/// </summary>
internal sealed class SecurityHeadersMiddleware
{
    private const string ContentSecurityPolicy =
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; font-src 'self' data:; connect-src 'self' https:; " +
        "base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'none'";

    private readonly RequestDelegate next;

    public SecurityHeadersMiddleware(RequestDelegate next)
    {
        this.next = next;
    }

    public Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "same-origin";
        headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()";

        // Skip CSP for Swagger UI, which relies on inline scripts/styles (Development only).
        if (!context.Request.Path.StartsWithSegments("/swagger"))
        {
            headers["Content-Security-Policy"] = ContentSecurityPolicy;
        }

        return next(context);
    }
}
