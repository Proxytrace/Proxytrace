using AwesomeAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Proxytrace.Licensing.Internal;

namespace Proxytrace.Licensing.Tests;

[TestClass]
public sealed class LicenseCheckServiceTests
{
    private readonly TestLicenseFactory factory = new();
    private readonly MutableClock clock = new(new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero));

    [TestCleanup]
    public void Teardown() => factory.Dispose();

    private (LicenseCheckService Service, LicenseService License, ILicenseServerClient Server, ILicenseCacheStore Cache)
        Build(LicenseCacheEntry? cached = null)
    {
        var config = factory.Configuration(factory.CreateJwt(tier: "Enterprise"));
        var validator = new JwtLicenseValidator(config, NullLogger<JwtLicenseValidator>.Instance);

        var server = Substitute.For<ILicenseServerClient>();
        var cache = Substitute.For<ILicenseCacheStore>();
        cache.Load().Returns(cached);

        // The refresh trigger resolves to the check service; a holder lets us wire the cycle
        // after both objects are constructed, without null-forgiving.
        var holder = new TriggerHolder();
        var license = new LicenseService(config, validator, holder.Resolve, NullLogger<LicenseService>.Instance);
        var checkService = new LicenseCheckService(
            license, server, cache, config, clock, NullLogger<LicenseCheckService>.Instance);
        holder.Trigger = checkService;

        return (checkService, license, server, cache);
    }

    private sealed class TriggerHolder
    {
        public ILicenseRefreshTrigger? Trigger { get; set; }

        public ILicenseRefreshTrigger Resolve()
            => Trigger ?? throw new InvalidOperationException("Trigger not wired");
    }

    private LicenseCheckResult Valid() => new(LicenseCheckResult.Valid, null, null, clock.UtcNow);
    private LicenseCheckResult Revoked() => new(LicenseCheckResult.Revoked, null, null, clock.UtcNow);
    private LicenseCheckResult Unknown() => new(LicenseCheckResult.Unknown, null, null, clock.UtcNow);

    [TestMethod]
    public async Task ValidResult_StaysActive()
    {
        var (service, license, server, cache) = Build();
        server.CheckAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Valid());

        await service.RunCheckNowAsync(CancellationToken.None);

        license.Current.Status.Should().Be(LicenseStatus.Active);
        cache.Received().Save(Arg.Any<LicenseCacheEntry>());
    }

    [TestMethod]
    public async Task RevokedResult_DowngradesToExpired()
    {
        var (service, license, server, _) = Build();
        server.CheckAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Revoked());

        await service.RunCheckNowAsync(CancellationToken.None);

        license.Current.Status.Should().Be(LicenseStatus.Expired);
        license.Current.Tier.Should().Be(LicenseTier.Free);
        license.IsFeatureEnabled(LicenseFeature.AgenticEvaluators).Should().BeFalse();
    }

    [TestMethod]
    public async Task Unreachable_6Days_StaysActive()
    {
        var lastOk = clock.UtcNow;
        var (service, license, server, _) = Build(new LicenseCacheEntry("jti", lastOk, "valid"));
        server.CheckAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Unknown());

        clock.Advance(TimeSpan.FromDays(6));
        await service.RunCheckNowAsync(CancellationToken.None);

        license.Current.Status.Should().Be(LicenseStatus.Active);
    }

    [TestMethod]
    public async Task Unreachable_7Days_EntersGrace()
    {
        var lastOk = clock.UtcNow;
        var (service, license, server, _) = Build(new LicenseCacheEntry("jti", lastOk, "valid"));
        server.CheckAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Unknown());

        clock.Advance(TimeSpan.FromDays(7));
        await service.RunCheckNowAsync(CancellationToken.None);

        license.Current.Status.Should().Be(LicenseStatus.Grace);
        license.Current.GracePeriodEndsAt.Should().NotBeNull();
    }

    [TestMethod]
    public async Task Unreachable_14Days_DowngradesToFree()
    {
        var lastOk = clock.UtcNow;
        var (service, license, server, _) = Build(new LicenseCacheEntry("jti", lastOk, "valid"));
        server.CheckAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Unknown());

        clock.Advance(TimeSpan.FromDays(14));
        await service.RunCheckNowAsync(CancellationToken.None);

        license.Current.Status.Should().Be(LicenseStatus.Free);
        license.Current.Tier.Should().Be(LicenseTier.Free);
    }

    [TestMethod]
    public async Task ForceRefresh_TriggersImmediateCheck()
    {
        var (_, license, server, _) = Build();
        server.CheckAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Revoked());

        await license.ForceRefreshAsync(CancellationToken.None);

        await server.Received(1).CheckAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
        license.Current.Status.Should().Be(LicenseStatus.Expired);
    }
}
