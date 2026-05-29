using AwesomeAssertions;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;
using Proxytrace.Domain.ApiKey;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Project;
using Proxytrace.Proxy.Internal;

namespace Proxytrace.Proxy.Tests;

[TestClass]
public sealed class CachedApiKeyResolverTests
{
    [TestMethod]
    public async Task ResolveAsync_WithinTtl_HitsRepositoryOnce()
    {
        IApiKey apiKey = ProxytraceKey();
        var apiKeys = Substitute.For<IApiKeyRepository>();
        var providers = Substitute.For<IModelProviderRepository>();
        var projects = Substitute.For<IProjectRepository>();
        apiKeys.FindByKeyAsync("key", Arg.Any<CancellationToken>()).Returns(apiKey);

        var resolver = NewResolver(apiKeys, providers, projects, TimeSpan.FromSeconds(30));

        var first = await resolver.ResolveAsync("key", projectSlug: null, CancellationToken.None);
        var second = await resolver.ResolveAsync("key", projectSlug: null, CancellationToken.None);

        first.Should().NotBeNull();
        first.Provider.Should().BeSameAs(apiKey.Provider);
        second.Should().BeSameAs(first);
        await apiKeys.Received(1).FindByKeyAsync("key", Arg.Any<CancellationToken>());
        await providers.DidNotReceive().FindByApiKeyAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task ResolveAsync_WhenNotFound_DoesNotCacheNull()
    {
        var apiKeys = Substitute.For<IApiKeyRepository>();
        var providers = Substitute.For<IModelProviderRepository>();
        var projects = Substitute.For<IProjectRepository>();
        apiKeys.FindByKeyAsync("missing", Arg.Any<CancellationToken>()).Returns((IApiKey?)null);
        providers.FindByApiKeyAsync("missing", Arg.Any<CancellationToken>()).Returns((IModelProvider?)null);

        var resolver = NewResolver(apiKeys, providers, projects, TimeSpan.FromSeconds(30));

        (await resolver.ResolveAsync("missing", "p", CancellationToken.None)).Should().BeNull();
        (await resolver.ResolveAsync("missing", "p", CancellationToken.None)).Should().BeNull();

        await apiKeys.Received(2).FindByKeyAsync("missing", Arg.Any<CancellationToken>());
        await providers.Received(2).FindByApiKeyAsync("missing", Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task ResolveAsync_WhenEntryExpired_RefetchesFromRepository()
    {
        IApiKey apiKey = ProxytraceKey();
        var apiKeys = Substitute.For<IApiKeyRepository>();
        var providers = Substitute.For<IModelProviderRepository>();
        var projects = Substitute.For<IProjectRepository>();
        apiKeys.FindByKeyAsync("key", Arg.Any<CancellationToken>()).Returns(apiKey);

        // Zero TTL disables caching, so every lookup hits the repository again.
        var resolver = NewResolver(apiKeys, providers, projects, TimeSpan.Zero);

        await resolver.ResolveAsync("key", projectSlug: null, CancellationToken.None);
        await resolver.ResolveAsync("key", projectSlug: null, CancellationToken.None);

        await apiKeys.Received(2).FindByKeyAsync("key", Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task ResolveAsync_UpstreamProviderKey_ResolvesProjectFromSlug()
    {
        var provider = Provider();
        var project = Substitute.For<IProject>();
        project.Id.Returns(Guid.NewGuid());

        var apiKeys = Substitute.For<IApiKeyRepository>();
        var providers = Substitute.For<IModelProviderRepository>();
        var projects = Substitute.For<IProjectRepository>();
        apiKeys.FindByKeyAsync("upstream", Arg.Any<CancellationToken>()).Returns((IApiKey?)null);
        providers.FindByApiKeyAsync("upstream", Arg.Any<CancellationToken>()).Returns(provider);
        projects.FindBySlugAsync("my-project", Arg.Any<CancellationToken>()).Returns(project);

        var resolver = NewResolver(apiKeys, providers, projects, TimeSpan.FromSeconds(30));

        var result = await resolver.ResolveAsync("upstream", "my-project", CancellationToken.None);

        result.Should().NotBeNull();
        result.Provider.Should().BeSameAs(provider);
        result.Project.Should().BeSameAs(project);
    }

    [TestMethod]
    public async Task ResolveAsync_UpstreamProviderKey_RejectsWhenSlugMissing()
    {
        var provider = Provider();

        var apiKeys = Substitute.For<IApiKeyRepository>();
        var providers = Substitute.For<IModelProviderRepository>();
        var projects = Substitute.For<IProjectRepository>();
        apiKeys.FindByKeyAsync("upstream", Arg.Any<CancellationToken>()).Returns((IApiKey?)null);
        providers.FindByApiKeyAsync("upstream", Arg.Any<CancellationToken>()).Returns(provider);

        var resolver = NewResolver(apiKeys, providers, projects, TimeSpan.FromSeconds(30));

        (await resolver.ResolveAsync("upstream", projectSlug: null, CancellationToken.None)).Should().BeNull();
        await projects.DidNotReceive().FindBySlugAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task ResolveAsync_UpstreamProviderKey_RejectsWhenSlugUnknown()
    {
        var provider = Provider();

        var apiKeys = Substitute.For<IApiKeyRepository>();
        var providers = Substitute.For<IModelProviderRepository>();
        var projects = Substitute.For<IProjectRepository>();
        apiKeys.FindByKeyAsync("upstream", Arg.Any<CancellationToken>()).Returns((IApiKey?)null);
        providers.FindByApiKeyAsync("upstream", Arg.Any<CancellationToken>()).Returns(provider);
        projects.FindBySlugAsync("ghost", Arg.Any<CancellationToken>()).Returns((IProject?)null);

        var resolver = NewResolver(apiKeys, providers, projects, TimeSpan.FromSeconds(30));

        (await resolver.ResolveAsync("upstream", "ghost", CancellationToken.None)).Should().BeNull();
    }

    [TestMethod]
    public async Task ResolveAsync_ProxytraceKey_RejectsWhenSlugMismatches()
    {
        IApiKey apiKey = ProxytraceKey("Showcase Project");
        var apiKeys = Substitute.For<IApiKeyRepository>();
        var providers = Substitute.For<IModelProviderRepository>();
        var projects = Substitute.For<IProjectRepository>();
        apiKeys.FindByKeyAsync("pt", Arg.Any<CancellationToken>()).Returns(apiKey);

        var resolver = NewResolver(apiKeys, providers, projects, TimeSpan.FromSeconds(30));

        (await resolver.ResolveAsync("pt", "other-project", CancellationToken.None)).Should().BeNull();
    }

    [TestMethod]
    public async Task ResolveAsync_ProxytraceKey_AcceptsMatchingSlug()
    {
        IApiKey apiKey = ProxytraceKey("Showcase Project");
        var apiKeys = Substitute.For<IApiKeyRepository>();
        var providers = Substitute.For<IModelProviderRepository>();
        var projects = Substitute.For<IProjectRepository>();
        apiKeys.FindByKeyAsync("pt", Arg.Any<CancellationToken>()).Returns(apiKey);

        var resolver = NewResolver(apiKeys, providers, projects, TimeSpan.FromSeconds(30));

        var result = await resolver.ResolveAsync("pt", "showcase-project", CancellationToken.None);

        result.Should().NotBeNull();
        result.Project.Should().BeSameAs(apiKey.Project);
    }

    [TestMethod]
    public async Task ResolveAsync_ProxytraceKeyWins_OnCollisionWithProviderKey()
    {
        IApiKey apiKey = ProxytraceKey();
        var apiKeys = Substitute.For<IApiKeyRepository>();
        var providers = Substitute.For<IModelProviderRepository>();
        var projects = Substitute.For<IProjectRepository>();
        apiKeys.FindByKeyAsync("colliding", Arg.Any<CancellationToken>()).Returns(apiKey);

        var resolver = NewResolver(apiKeys, providers, projects, TimeSpan.FromSeconds(30));

        var result = await resolver.ResolveAsync("colliding", projectSlug: null, CancellationToken.None);

        result.Should().NotBeNull();
        result.Provider.Should().BeSameAs(apiKey.Provider);
        await providers.DidNotReceive().FindByApiKeyAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    private static CachedApiKeyResolver NewResolver(
        IApiKeyRepository apiKeys,
        IModelProviderRepository providers,
        IProjectRepository projects,
        TimeSpan ttl)
        => new(apiKeys, providers, projects, new MemoryCache(new MemoryCacheOptions()), ttl);

    private static IApiKey ProxytraceKey(string projectName = "Some Project")
    {
        var apiKey = Substitute.For<IApiKey>();
        var provider = Provider();
        var project = Substitute.For<IProject>();
        project.Id.Returns(Guid.NewGuid());
        project.Name.Returns(projectName);
        apiKey.Provider.Returns(provider);
        apiKey.Project.Returns(project);
        return apiKey;
    }

    private static IModelProvider Provider()
    {
        var provider = Substitute.For<IModelProvider>();
        provider.Id.Returns(Guid.NewGuid());
        return provider;
    }
}
