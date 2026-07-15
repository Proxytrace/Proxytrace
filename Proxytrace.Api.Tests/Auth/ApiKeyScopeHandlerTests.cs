using System.Security.Claims;
using AwesomeAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using NSubstitute;
using Proxytrace.Api.Auth.Rest;
using Proxytrace.Domain.ApiKey;

namespace Proxytrace.Api.Tests.Auth;

[TestClass]
public sealed class ApiKeyScopeHandlerTests
{
    [TestMethod]
    public async Task ApiKeyCaller_GetWithReadScope_Succeeds()
    {
        var context = await Evaluate("GET", ApiKeyPrincipal(nameof(ApiKeyScopes.ApiRead)));
        context.HasSucceeded.Should().BeTrue();
    }

    [TestMethod]
    public async Task ApiKeyCaller_PostWithOnlyReadScope_Fails()
    {
        // A write request needs the write scope; a read-only key must not mutate.
        var context = await Evaluate("POST", ApiKeyPrincipal(nameof(ApiKeyScopes.ApiRead)));
        context.HasSucceeded.Should().BeFalse();
    }

    [TestMethod]
    public async Task ApiKeyCaller_PostWithWriteScope_Succeeds()
    {
        var context = await Evaluate("POST", ApiKeyPrincipal(nameof(ApiKeyScopes.ApiRead), nameof(ApiKeyScopes.ApiWrite)));
        context.HasSucceeded.Should().BeTrue();
    }

    [TestMethod]
    public async Task ApiKeyCaller_GetWithOnlyWriteScope_Fails()
    {
        // A read request needs the read scope even for an otherwise write-capable key.
        var context = await Evaluate("GET", ApiKeyPrincipal(nameof(ApiKeyScopes.ApiWrite)));
        context.HasSucceeded.Should().BeFalse();
    }

    [TestMethod]
    public async Task NonApiKeyCaller_PostWithNoScopes_Succeeds()
    {
        // A JWT/cookie session is governed by roles, not REST scopes — the requirement never constrains it.
        var jwt = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.Name, "user")], "Bearer"));
        var context = await Evaluate("POST", jwt);
        context.HasSucceeded.Should().BeTrue();
    }

    private static async Task<AuthorizationHandlerContext> Evaluate(string method, ClaimsPrincipal principal)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Method = method;
        httpContext.User = principal;

        var accessor = Substitute.For<IHttpContextAccessor>();
        accessor.HttpContext.Returns(httpContext);

        var requirement = new ApiKeyScopeRequirement();
        var context = new AuthorizationHandlerContext([requirement], principal, httpContext);
        var handler = new ApiKeyScopeHandler(accessor);
        await handler.HandleAsync(context);
        return context;
    }

    private static ClaimsPrincipal ApiKeyPrincipal(params string[] scopes)
    {
        var claims = scopes.Select(s => new Claim(ApiKeyAuthenticationHandler.ScopeClaimType, s)).ToList();
        return new ClaimsPrincipal(new ClaimsIdentity(claims, ApiKeyAuthenticationHandler.SchemeName));
    }
}
