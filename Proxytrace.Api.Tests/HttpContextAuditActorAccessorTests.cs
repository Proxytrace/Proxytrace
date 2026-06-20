using System.Security.Claims;
using AwesomeAssertions;
using Microsoft.AspNetCore.Http;
using NSubstitute;
using Proxytrace.Api.Auth;
using Proxytrace.Api.Auth.Mcp;
using Proxytrace.Application.AuditLog;
using Proxytrace.Domain.AuditLog;

namespace Proxytrace.Api.Tests;

/// <summary>
/// Unit tests for actor enrichment. The real accessor reads the request context synchronously with no
/// DB hit, so these construct it directly over a substituted <see cref="IHttpContextAccessor"/> rather
/// than the full DI container.
/// </summary>
[TestClass]
public sealed class HttpContextAuditActorAccessorTests
{
    private static AuditActor Resolve(HttpContext? context)
    {
        var accessor = Substitute.For<IHttpContextAccessor>();
        accessor.HttpContext.Returns(context);
        return new HttpContextAuditActorAccessor(accessor).GetCurrentActor();
    }

    [TestMethod]
    public void GetCurrentActor_NoHttpContext_ReturnsSystem()
    {
        var actor = Resolve(null);

        actor.Should().Be(AuditActor.System);
    }

    [TestMethod]
    public void GetCurrentActor_WithUserIdAndEmailClaim_ReturnsUserActor()
    {
        var userId = Guid.NewGuid();
        var ctx = new DefaultHttpContext();
        ctx.Items[CurrentUserAccessor.UserIdItemKey] = userId;
        var identity = new ClaimsIdentity("Bearer");
        identity.AddClaim(new Claim("email", "admin@example.com"));
        ctx.User = new ClaimsPrincipal(identity);

        var actor = Resolve(ctx);

        actor.Type.Should().Be(AuditActorType.User);
        actor.UserId.Should().Be(userId);
        actor.Email.Should().Be("admin@example.com");
        actor.ApiKeyId.Should().BeNull();
    }

    [TestMethod]
    public void GetCurrentActor_WithApiKeyScheme_ReturnsApiKeyActorWithNoEmail()
    {
        var ownerId = Guid.NewGuid();
        var keyId = Guid.NewGuid();
        var ctx = new DefaultHttpContext();
        ctx.Items[CurrentUserAccessor.UserIdItemKey] = ownerId;
        ctx.Items[McpApiKeyAuthenticationHandler.ApiKeyIdItemKey] = keyId;
        // API-key requests are detected by their authentication scheme and carry no email claim.
        ctx.User = new ClaimsPrincipal(new ClaimsIdentity(McpApiKeyAuthenticationHandler.SchemeName));

        var actor = Resolve(ctx);

        actor.Type.Should().Be(AuditActorType.ApiKey);
        actor.UserId.Should().Be(ownerId);
        actor.ApiKeyId.Should().Be(keyId);
        actor.Email.Should().BeNull();
    }

    [TestMethod]
    public void GetCurrentActor_AnonymousRequest_ReturnsSystem()
    {
        // A request with a context but no resolved user and no API-key scheme (e.g. an anonymous
        // endpoint) is attributed to the System actor, not a half-populated user.
        var ctx = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) };

        var actor = Resolve(ctx);

        actor.Should().Be(AuditActor.System);
    }
}
