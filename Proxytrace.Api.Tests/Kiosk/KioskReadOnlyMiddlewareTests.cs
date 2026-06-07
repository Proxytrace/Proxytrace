using AwesomeAssertions;
using Microsoft.AspNetCore.Http;
using Proxytrace.Api.Kiosk;
using Proxytrace.Application.Demo;

namespace Proxytrace.Api.Tests.Kiosk;

[TestClass]
public sealed class KioskReadOnlyMiddlewareTests
{
    private static async Task<(HttpContext Context, bool NextCalled)> InvokeAsync(
        string method, string path, KioskOptions options, KioskEndpointOptions endpoint)
    {
        var nextCalled = false;
        var middleware = new KioskReadOnlyMiddleware(
            _ =>
            {
                nextCalled = true;
                return Task.CompletedTask;
            },
            options,
            endpoint);

        var ctx = new DefaultHttpContext();
        ctx.Request.Method = method;
        ctx.Request.Path = path;
        ctx.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(ctx);
        return (ctx, nextCalled);
    }

    private static KioskEndpointOptions ConfiguredEndpoint() => new()
    {
        BaseUrl = "https://api.openai.com/v1",
        ApiKey = "sk-test",
        Model = "gpt-4o",
    };

    [TestMethod]
    public async Task InvokeAsync_KioskDisabled_AllowsWrite()
    {
        var (ctx, next) = await InvokeAsync(
            "POST", "/api/agents", new KioskOptions { Enabled = false }, new KioskEndpointOptions());

        next.Should().BeTrue();
        ctx.Response.StatusCode.Should().NotBe(StatusCodes.Status403Forbidden);
    }

    [TestMethod]
    public async Task InvokeAsync_KioskEnabled_GetRequest_PassesThrough()
    {
        var (_, next) = await InvokeAsync(
            "GET", "/api/agents", new KioskOptions { Enabled = true }, new KioskEndpointOptions());

        next.Should().BeTrue();
    }

    [TestMethod]
    public async Task InvokeAsync_KioskEnabled_WriteWithoutEndpoint_ReturnsForbidden()
    {
        var (ctx, next) = await InvokeAsync(
            "POST", "/api/agents", new KioskOptions { Enabled = true }, new KioskEndpointOptions());

        next.Should().BeFalse();
        ctx.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    [TestMethod]
    public async Task InvokeAsync_KioskEnabled_WriteWithConfiguredEndpoint_PassesThrough()
    {
        var (ctx, next) = await InvokeAsync(
            "POST", "/api/test-run-groups", new KioskOptions { Enabled = true }, ConfiguredEndpoint());

        next.Should().BeTrue();
        ctx.Response.StatusCode.Should().NotBe(StatusCodes.Status403Forbidden);
    }

    [TestMethod]
    public async Task InvokeAsync_KioskEnabled_TraceyWriteWithConfiguredEndpoint_PassesThrough()
    {
        var (_, next) = await InvokeAsync(
            "POST", "/api/tracey/chat", new KioskOptions { Enabled = true }, ConfiguredEndpoint());

        next.Should().BeTrue();
    }

    [TestMethod]
    public async Task InvokeAsync_KioskEnabled_TraceyWriteWithoutEndpoint_ReturnsForbidden()
    {
        var (ctx, next) = await InvokeAsync(
            "POST", "/api/tracey/chat", new KioskOptions { Enabled = true }, new KioskEndpointOptions());

        next.Should().BeFalse();
        ctx.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }
}
