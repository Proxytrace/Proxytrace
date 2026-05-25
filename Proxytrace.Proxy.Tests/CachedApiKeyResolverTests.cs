using AwesomeAssertions;
using NSubstitute;
using Proxytrace.Domain.ApiKey;

namespace Proxytrace.Proxy.Tests;

[TestClass]
public sealed class CachedApiKeyResolverTests
{
    [TestMethod]
    public async Task ResolveAsync_WithinTtl_HitsRepositoryOnce()
    {
        var apiKey = Substitute.For<IApiKey>();
        var repository = Substitute.For<IApiKeyRepository>();
        repository.FindByKeyAsync("key", Arg.Any<CancellationToken>()).Returns(apiKey);

        var resolver = new CachedApiKeyResolver(repository, TimeSpan.FromSeconds(30));

        (await resolver.ResolveAsync("key", CancellationToken.None)).Should().BeSameAs(apiKey);
        (await resolver.ResolveAsync("key", CancellationToken.None)).Should().BeSameAs(apiKey);

        await repository.Received(1).FindByKeyAsync("key", Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task ResolveAsync_WhenNotFound_DoesNotCacheNull()
    {
        var repository = Substitute.For<IApiKeyRepository>();
        repository.FindByKeyAsync("missing", Arg.Any<CancellationToken>()).Returns((IApiKey?)null);

        var resolver = new CachedApiKeyResolver(repository, TimeSpan.FromSeconds(30));

        (await resolver.ResolveAsync("missing", CancellationToken.None)).Should().BeNull();
        (await resolver.ResolveAsync("missing", CancellationToken.None)).Should().BeNull();

        await repository.Received(2).FindByKeyAsync("missing", Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task ResolveAsync_WhenEntryExpired_RefetchesFromRepository()
    {
        var apiKey = Substitute.For<IApiKey>();
        var repository = Substitute.For<IApiKeyRepository>();
        repository.FindByKeyAsync("key", Arg.Any<CancellationToken>()).Returns(apiKey);

        // Zero TTL means every cached entry is already expired on the next lookup.
        var resolver = new CachedApiKeyResolver(repository, TimeSpan.Zero);

        await resolver.ResolveAsync("key", CancellationToken.None);
        await resolver.ResolveAsync("key", CancellationToken.None);

        await repository.Received(2).FindByKeyAsync("key", Arg.Any<CancellationToken>());
    }
}
