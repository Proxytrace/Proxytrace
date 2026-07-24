using System.Net;
using System.Text;
using AwesomeAssertions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Mvc.ApplicationParts;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Proxytrace.Domain.Kiosk;
using Proxytrace.Messaging;
using Proxytrace.Proxy.Controllers;

namespace Proxytrace.Proxy.Tests;

/// <summary>
/// Guards the kiosk-showcase mounting rule that <c>Proxytrace.Api/Program.cs</c> implements: the
/// OpenAI-compatible proxy controller (which lives in this shared library, referenced by the API but
/// NOT an MVC application part by default) is added as an application part — so its
/// <c>openai/v1/{**path}</c> routes resolve — ONLY when kiosk mode runs with a live
/// <c>Kiosk:Endpoint</c>. In production and kiosk-without-endpoint the route must not exist (404).
/// The mounted route with no proxy API key returns 401, which distinguishes "route matched" from
/// "route absent". This test also proves the controller assembly is not silently auto-discovered.
/// </summary>
[TestClass]
public sealed class KioskProxyMountingTests
{
    [TestMethod]
    [DataRow(true, true, false, DisplayName = "kiosk + live endpoint -> route mounted (401, not 404)")]
    [DataRow(true, false, true, DisplayName = "kiosk without endpoint -> route absent (404)")]
    [DataRow(false, false, true, DisplayName = "non-kiosk (production) -> route absent (404)")]
    public async Task ProxyRoute_IsMounted_OnlyForKioskWithLiveEndpoint(
        bool kioskEnabled, bool endpointConfigured, bool expectRouteAbsent)
    {
        await using var app = await StartHostAsync(kioskEnabled, endpointConfigured);
        using var client = app.GetTestClient();

        using var request = new HttpRequestMessage(HttpMethod.Post, "/openai/v1/chat/completions")
        {
            // No Authorization header on purpose: a mounted route rejects with 401, an absent one 404s.
            Content = new StringContent("""{"model":"gpt-4o","messages":[]}""", Encoding.UTF8, "application/json"),
        };

        var response = await client.SendAsync(request, CancellationToken.None);

        if (expectRouteAbsent)
        {
            response.StatusCode.Should().Be(HttpStatusCode.NotFound,
                "the proxy route must not exist outside kiosk mode with a live endpoint");
        }
        else
        {
            response.StatusCode.Should().Be(HttpStatusCode.Unauthorized,
                "the mounted route matched and rejected the keyless request");
        }
    }

    private static async Task<WebApplication> StartHostAsync(bool kioskEnabled, bool endpointConfigured)
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();

        builder.Services.AddSingleton(Substitute.For<IIngestionStream>());
        builder.Services.AddSingleton<IHttpClientFactory>(new FakeHttpClientFactory("{}"));

        var resolver = Substitute.For<IApiKeyResolver>();
        resolver.ResolveAsync(Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns((ResolvedApiKey?)null);
        builder.Services.AddSingleton(resolver);
        builder.Services.AddSingleton(Substitute.For<IRequestBlocker>());

        builder.Services.AddSingleton(new KioskOptions { Enabled = kioskEnabled });
        builder.Services.AddSingleton(endpointConfigured
            ? new KioskEndpointOptions { BaseUrl = "https://api.example-llm.com/v1", ApiKey = "sk-live", Model = "demo-gpt" }
            : new KioskEndpointOptions());

        // Register controllers WITHOUT the proxy application part — exactly as Program.cs does before
        // its post-build conditional add.
        builder.Services.AddControllers();

        var app = builder.Build();

        // Mirror Program.cs: add the proxy controller's assembly as an application part only when kiosk
        // runs with a live endpoint. Done post-build (before MapControllers) so the action descriptors
        // pick it up.
        var mount = app.Services.GetRequiredService<KioskOptions>().Enabled
                    && app.Services.GetRequiredService<KioskEndpointOptions>().IsConfigured;
        if (mount)
        {
            app.Services.GetRequiredService<ApplicationPartManager>()
                .ApplicationParts.Add(new AssemblyPart(typeof(OpenAiProxyController).Assembly));
        }

        app.MapControllers();

        await app.StartAsync(CancellationToken.None);
        return app;
    }
}
