using AwesomeAssertions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Proxytrace.Domain.CustomAnomaly;
using Proxytrace.Licensing;
using Proxytrace.Proxy.Internal;

namespace Proxytrace.Proxy.Tests;

[TestClass]
public sealed class CachedBlockingRuleProviderTests
{
    [TestMethod]
    public async Task GetRulesAsync_WithinTtl_HitsRepositoryOnce()
    {
        var projectId = Guid.NewGuid();
        var detectors = Substitute.For<ICustomAnomalyDetectorRepository>();
        detectors.GetEnabledBlockingRulesByProjectAsync(projectId, Arg.Any<CancellationToken>())
            .Returns([SomeRule()]);

        var provider = NewProvider(detectors, TimeSpan.FromSeconds(30));

        var first = await provider.GetRulesAsync(projectId, CancellationToken.None);
        var second = await provider.GetRulesAsync(projectId, CancellationToken.None);

        first.Should().ContainSingle();
        second.Should().BeSameAs(first);
        await detectors.Received(1).GetEnabledBlockingRulesByProjectAsync(projectId, Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task GetRulesAsync_EmptyRuleList_IsCachedToo()
    {
        // Most projects have no blocking detectors — without negative caching, every proxied
        // request would query the database.
        var projectId = Guid.NewGuid();
        var detectors = Substitute.For<ICustomAnomalyDetectorRepository>();
        detectors.GetEnabledBlockingRulesByProjectAsync(projectId, Arg.Any<CancellationToken>())
            .Returns([]);

        var provider = NewProvider(detectors, TimeSpan.FromSeconds(30));

        (await provider.GetRulesAsync(projectId, CancellationToken.None)).Should().BeEmpty();
        (await provider.GetRulesAsync(projectId, CancellationToken.None)).Should().BeEmpty();

        await detectors.Received(1).GetEnabledBlockingRulesByProjectAsync(projectId, Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task GetRulesAsync_ZeroTtl_RefetchesEveryCall()
    {
        var projectId = Guid.NewGuid();
        var detectors = Substitute.For<ICustomAnomalyDetectorRepository>();
        detectors.GetEnabledBlockingRulesByProjectAsync(projectId, Arg.Any<CancellationToken>())
            .Returns([SomeRule()]);

        var provider = NewProvider(detectors, TimeSpan.Zero);

        await provider.GetRulesAsync(projectId, CancellationToken.None);
        await provider.GetRulesAsync(projectId, CancellationToken.None);

        await detectors.Received(2).GetEnabledBlockingRulesByProjectAsync(projectId, Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task GetRulesAsync_UnlicensedFeature_ReturnsEmptyWithoutRepositoryCall()
    {
        var detectors = Substitute.For<ICustomAnomalyDetectorRepository>();
        var provider = NewProvider(detectors, TimeSpan.FromSeconds(30), featureEnabled: false);

        var rules = await provider.GetRulesAsync(Guid.NewGuid(), CancellationToken.None);

        rules.Should().BeEmpty();
        await detectors.DidNotReceive()
            .GetEnabledBlockingRulesByProjectAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public async Task GetRulesAsync_RepositoryError_FailsOpenAndDoesNotCacheTheFailure()
    {
        var projectId = Guid.NewGuid();
        var detectors = Substitute.For<ICustomAnomalyDetectorRepository>();
        detectors.GetEnabledBlockingRulesByProjectAsync(projectId, Arg.Any<CancellationToken>())
            .Throws(new InvalidOperationException("db down"));

        var provider = NewProvider(detectors, TimeSpan.FromSeconds(30));

        // Fail-open: an infrastructure problem must not take LLM traffic down.
        (await provider.GetRulesAsync(projectId, CancellationToken.None)).Should().BeEmpty();

        // The failure is NOT cached — once the database recovers, blocking resumes immediately.
        detectors.GetEnabledBlockingRulesByProjectAsync(projectId, Arg.Any<CancellationToken>())
            .Returns([SomeRule()]);
        (await provider.GetRulesAsync(projectId, CancellationToken.None)).Should().ContainSingle();
    }

    private static CachedBlockingRuleProvider NewProvider(
        ICustomAnomalyDetectorRepository detectors,
        TimeSpan ttl,
        bool featureEnabled = true)
    {
        var license = Substitute.For<ILicenseService>();
        license.IsFeatureEnabled(LicenseFeature.CustomAnomalyDetectors).Returns(featureEnabled);
        return new CachedBlockingRuleProvider(
            detectors,
            license,
            new MemoryCache(new MemoryCacheOptions()),
            ttl,
            NullLogger<CachedBlockingRuleProvider>.Instance);
    }

    private static BlockingDetectorRule SomeRule()
        => new(Guid.NewGuid(), "Guard", [new AnomalyTrigger(TriggerKind.Phrase, "hunter2")], true, []);
}
