using System.Net;
using System.Net.Http.Headers;
using System.Text.Encodings.Web;
using AwesomeAssertions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NSubstitute;
using Proxytrace.Api.Auth.Rest;
using Proxytrace.Domain.ApiKey;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.User;

namespace Proxytrace.Api.Tests.Auth;

/// <summary>
/// End-to-end wiring guard for the scoped REST API key over real HTTP. A TestServer host wires the exact
/// auth recipe production's non-kiosk branch uses — the ApiKey scheme registered alongside JwtBearer, a
/// default authorization policy that accepts both and carries the <see cref="ApiKeyScopeRequirement"/>,
/// and the <see cref="ApiKeyScopeHandler"/> — then exercises a read endpoint, a write endpoint, and an
/// admin (role-gated) endpoint with a key as the bearer token. (The full Module runs kiosk-by-default in
/// tests, whose scheme auto-authenticates everyone, so it can't exercise this branch — hence the direct
/// wiring here.)
/// </summary>
[TestClass]
public sealed class ApiKeyRestEndpointTests
{
    [TestMethod]
    public async Task ReadEndpoint_WithApiReadKey_Returns200()
    {
        await using var app = await StartHostAsync(("proxytrace-read", ApiKeyScopes.ApiRead));
        (await Send(app, HttpMethod.Get, "/probe/read", "proxytrace-read")).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [TestMethod]
    public async Task WriteEndpoint_WithReadOnlyKey_Returns403()
    {
        await using var app = await StartHostAsync(("proxytrace-ro", ApiKeyScopes.ApiRead));
        // Authenticated, but the read-only key lacks the ApiWrite scope a mutation needs.
        (await Send(app, HttpMethod.Post, "/probe/write", "proxytrace-ro")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [TestMethod]
    public async Task WriteEndpoint_WithWriteKey_Returns200()
    {
        await using var app = await StartHostAsync(("proxytrace-rw", ApiKeyScopes.ApiRead | ApiKeyScopes.ApiWrite));
        (await Send(app, HttpMethod.Post, "/probe/write", "proxytrace-rw")).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [TestMethod]
    public async Task AdminEndpoint_WithApiKey_Returns403()
    {
        await using var app = await StartHostAsync(("proxytrace-rw", ApiKeyScopes.ApiRead | ApiKeyScopes.ApiWrite));
        // A scoped key carries no role claim, so an admin-only endpoint stays out of reach.
        (await Send(app, HttpMethod.Get, "/probe/admin", "proxytrace-rw")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [TestMethod]
    public async Task ReadEndpoint_WithMcpOnlyKey_Returns401()
    {
        await using var app = await StartHostAsync(("proxytrace-mcp", ApiKeyScopes.McpRead | ApiKeyScopes.McpWrite));
        // A key without any REST scope does not authenticate at the REST API at all.
        (await Send(app, HttpMethod.Get, "/probe/read", "proxytrace-mcp")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [TestMethod]
    public async Task ReadEndpoint_WithNoCredential_Returns401()
    {
        await using var app = await StartHostAsync();
        (await Send(app, HttpMethod.Get, "/probe/read", apiKey: null)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    private static async Task<WebApplication> StartHostAsync(params (string RawKey, ApiKeyScopes Scopes)[] keys)
    {
        var apiKeys = Substitute.For<IApiKeyRepository>();
        foreach (var (rawKey, scopes) in keys)
        {
            // Build the substitute key BEFORE configuring Returns — creating a substitute inside a
            // Returns() argument corrupts NSubstitute's pending call context.
            var key = MakeKey(scopes);
            apiKeys.FindByKeyAsync(rawKey, Arg.Any<CancellationToken>()).Returns(key);
        }

        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddSingleton(apiKeys);
        builder.Services.AddSingleton<IAuthorizationHandler, ApiKeyScopeHandler>();

        // The exact scheme + policy recipe from Module.ConfigureAuth's non-kiosk branch.
        builder.Services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddScheme<AuthenticationSchemeOptions, NoResultHandler>(JwtBearerDefaults.AuthenticationScheme, _ => { })
            .AddScheme<AuthenticationSchemeOptions, ApiKeyAuthenticationHandler>(ApiKeyAuthenticationHandler.SchemeName, _ => { });
        builder.Services.AddAuthorization(options =>
        {
            options.DefaultPolicy = new AuthorizationPolicyBuilder(
                    JwtBearerDefaults.AuthenticationScheme,
                    ApiKeyAuthenticationHandler.SchemeName)
                .RequireAuthenticatedUser()
                .AddRequirements(new ApiKeyScopeRequirement())
                .Build();
        });

        var app = builder.Build();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapGet("/probe/read", () => Results.Ok("read")).RequireAuthorization();
        app.MapPost("/probe/write", () => Results.Ok("write")).RequireAuthorization();
        // Mirrors a controller with a class-level [Authorize] + method [Authorize(Roles = Admin)]: the
        // combined policy accepts the ApiKey scheme, so the key authenticates but is forbidden (403) for
        // lacking the admin role — rather than a bare 401 challenge.
        var adminPolicy = new AuthorizationPolicyBuilder(
                JwtBearerDefaults.AuthenticationScheme, ApiKeyAuthenticationHandler.SchemeName)
            .RequireAuthenticatedUser()
            .RequireRole("Admin")
            .Build();
        app.MapGet("/probe/admin", () => Results.Ok("admin")).RequireAuthorization(adminPolicy);

        await app.StartAsync(CancellationToken.None);
        return app;
    }

    private static IApiKey MakeKey(ApiKeyScopes scopes)
    {
        var owner = Substitute.For<IUser>();
        owner.Id.Returns(Guid.NewGuid());
        var project = Substitute.For<IProject>();
        project.Id.Returns(Guid.NewGuid());
        var key = Substitute.For<IApiKey>();
        key.Id.Returns(Guid.NewGuid());
        key.Name.Returns("rest");
        key.Scopes.Returns(scopes);
        key.Owner.Returns(owner);
        key.Project.Returns(project);
        return key;
    }

    private static async Task<HttpResponseMessage> Send(WebApplication app, HttpMethod method, string path, string? apiKey)
    {
        using var request = new HttpRequestMessage(method, path);
        if (apiKey is not null)
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        return await app.GetTestClient().SendAsync(request, CancellationToken.None);
    }

    /// <summary>A stand-in for the JwtBearer scheme that never authenticates — the ApiKey scheme owns
    /// <c>proxytrace-</c> bearers, and this proves adding it alongside Bearer doesn't disturb that.</summary>
    private sealed class NoResultHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public NoResultHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
            : base(options, logger, encoder)
        {
        }

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
            => Task.FromResult(AuthenticateResult.NoResult());
    }
}
