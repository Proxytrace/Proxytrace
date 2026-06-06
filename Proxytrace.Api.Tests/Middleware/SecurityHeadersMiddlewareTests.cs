using AwesomeAssertions;
using Microsoft.AspNetCore.Http;
using Proxytrace.Api.Middleware;

namespace Proxytrace.Api.Tests.Middleware;

[TestClass]
public sealed class SecurityHeadersMiddlewareTests
{
    private static async Task<HttpContext> InvokeAsync(string path)
    {
        var middleware = new SecurityHeadersMiddleware(_ => Task.CompletedTask, new SecurityHeadersOptions());
        var ctx = new DefaultHttpContext();
        ctx.Request.Path = path;
        await middleware.InvokeAsync(ctx);
        return ctx;
    }

    [TestMethod]
    public async Task InvokeAsync_NormalPath_SetsStrictCspAndBaseHeaders()
    {
        var ctx = await InvokeAsync("/api/agents");

        ctx.Response.Headers["Content-Security-Policy"].ToString()
            .Should().Be(new SecurityHeadersOptions().ContentSecurityPolicy);
        ctx.Response.Headers["X-Content-Type-Options"].ToString().Should().Be("nosniff");
        ctx.Response.Headers["X-Frame-Options"].ToString().Should().Be("DENY");
        ctx.Response.Headers["Referrer-Policy"].ToString().Should().Be("same-origin");
    }

    [TestMethod]
    public async Task InvokeAsync_DocsPath_UsesRelaxedCsp()
    {
        var ctx = await InvokeAsync("/docs/guide");

        ctx.Response.Headers["Content-Security-Policy"].ToString()
            .Should().Be(new SecurityHeadersOptions().DocsContentSecurityPolicy);
    }

    [TestMethod]
    public async Task InvokeAsync_SwaggerPath_OmitsCsp()
    {
        var ctx = await InvokeAsync("/swagger/index.html");

        ctx.Response.Headers.ContainsKey("Content-Security-Policy").Should().BeFalse();
    }
}
