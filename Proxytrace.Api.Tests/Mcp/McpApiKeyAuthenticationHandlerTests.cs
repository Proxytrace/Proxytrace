using System.Text.Encodings.Web;
using AwesomeAssertions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NSubstitute;
using Proxytrace.Api.Auth;
using Proxytrace.Api.Auth.Mcp;
using Proxytrace.Api.Mcp;
using Proxytrace.Domain;
using Proxytrace.Domain.ApiKey;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.User;
using Proxytrace.Testing;

namespace Proxytrace.Api.Tests.Mcp;

[TestClass]
public sealed class McpApiKeyAuthenticationHandlerTests : BaseTest<Module>
{
    [TestMethod]
    public async Task Authenticate_WithValidKey_SucceedsAndStashesProjectId()
    {
        IServiceProvider services = GetServices();
        var apiKey = await services.GetRequiredService<IDomainEntityGenerator<IApiKey>>().CreateAsync(CancellationToken);

        var (handler, context) = await BuildHandlerAsync(services, $"Bearer {apiKey.ApiKey}");
        var result = await handler.AuthenticateAsync();

        result.Succeeded.Should().BeTrue();
        context.Items[McpProjectAccessor.ProjectIdItemKey].Should().Be(apiKey.Project.Id);
        context.Items[CurrentUserAccessor.UserIdItemKey].Should().Be(apiKey.Owner.Id);
    }

    [TestMethod]
    public async Task Authenticate_TwoKeysForDifferentProjects_ResolveDistinctProjects()
    {
        IServiceProvider services = GetServices();
        var projectGen = services.GetRequiredService<IDomainEntityGenerator<IProject>>();
        var provider = await services.GetRequiredService<IDomainEntityGenerator<IModelProvider>>().CreateAsync(CancellationToken);
        var createApiKey = services.GetRequiredService<IApiKey.CreateNew>();
        var apiKeys = services.GetRequiredService<IApiKeyRepository>();

        var owner = await services.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);
        var projectA = await projectGen.CreateAsync(CancellationToken);
        var projectB = await projectGen.CreateAsync(CancellationToken);
        var keyA = await apiKeys.AddAsync(createApiKey("mcp-a", "proxytrace-secret-a", projectA, provider, ApiKeyScopes.McpRead, owner), CancellationToken);
        var keyB = await apiKeys.AddAsync(createApiKey("mcp-b", "proxytrace-secret-b", projectB, provider, ApiKeyScopes.McpRead, owner), CancellationToken);

        var (_, contextA) = await BuildHandlerAuthenticatedAsync(services, $"Bearer {keyA.ApiKey}");
        var (_, contextB) = await BuildHandlerAuthenticatedAsync(services, $"Bearer {keyB.ApiKey}");

        projectA.Id.Should().NotBe(projectB.Id);
        contextA.Items[McpProjectAccessor.ProjectIdItemKey].Should().Be(projectA.Id);
        contextB.Items[McpProjectAccessor.ProjectIdItemKey].Should().Be(projectB.Id);
    }

    [TestMethod]
    public async Task Authenticate_WithUnknownKey_Fails()
    {
        IServiceProvider services = GetServices();

        var (handler, context) = await BuildHandlerAsync(services, "Bearer proxytrace-does-not-exist");
        var result = await handler.AuthenticateAsync();

        result.Succeeded.Should().BeFalse();
        result.Failure.Should().NotBeNull();
        context.Items.Should().NotContainKey(McpProjectAccessor.ProjectIdItemKey);
    }

    [TestMethod]
    public async Task Authenticate_WithIngestionOnlyKey_Fails()
    {
        IServiceProvider services = GetServices();
        var project = await services.GetRequiredService<IDomainEntityGenerator<IProject>>().CreateAsync(CancellationToken);
        var provider = await services.GetRequiredService<IDomainEntityGenerator<IModelProvider>>().CreateAsync(CancellationToken);
        var createApiKey = services.GetRequiredService<IApiKey.CreateNew>();
        var apiKeys = services.GetRequiredService<IApiKeyRepository>();
        var owner = await services.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);
        var key = await apiKeys.AddAsync(
            createApiKey("ingest-only", "proxytrace-ingest-only", project, provider, ApiKeyScopes.Ingestion, owner),
            CancellationToken);

        var (handler, context) = await BuildHandlerAsync(services, $"Bearer {key.ApiKey}");
        var result = await handler.AuthenticateAsync();

        result.Succeeded.Should().BeFalse();
        result.Failure.Should().NotBeNull();
        context.Items.Should().NotContainKey(McpProjectAccessor.ProjectIdItemKey);
    }

    [TestMethod]
    public async Task Authenticate_WithoutBearerHeader_ReturnsNoResult()
    {
        IServiceProvider services = GetServices();

        var (handler, _) = await BuildHandlerAsync(services, authorization: null);
        var result = await handler.AuthenticateAsync();

        result.None.Should().BeTrue();
    }

    private static async Task<(McpApiKeyAuthenticationHandler Handler, DefaultHttpContext Context)> BuildHandlerAsync(
        IServiceProvider services, string? authorization)
    {
        var optionsMonitor = Substitute.For<IOptionsMonitor<AuthenticationSchemeOptions>>();
        optionsMonitor.Get(Arg.Any<string?>()).Returns(new AuthenticationSchemeOptions());

        var handler = new McpApiKeyAuthenticationHandler(
            optionsMonitor,
            NullLoggerFactory.Instance,
            UrlEncoder.Default,
            services.GetRequiredService<IApiKeyRepository>());

        var context = new DefaultHttpContext();
        if (authorization is not null)
            context.Request.Headers.Authorization = authorization;

        var scheme = new AuthenticationScheme(
            McpApiKeyAuthenticationHandler.SchemeName, null, typeof(McpApiKeyAuthenticationHandler));
        await handler.InitializeAsync(scheme, context);
        return (handler, context);
    }

    private static async Task<(McpApiKeyAuthenticationHandler Handler, DefaultHttpContext Context)> BuildHandlerAuthenticatedAsync(
        IServiceProvider services, string authorization)
    {
        var (handler, context) = await BuildHandlerAsync(services, authorization);
        await handler.AuthenticateAsync();
        return (handler, context);
    }
}
