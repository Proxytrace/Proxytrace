using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Proxytrace.Common.Time;
using Proxytrace.Licensing.Internal;
using Proxytrace.Testing;

namespace Proxytrace.Licensing.Tests;

[TestClass]
public sealed class LicenseCheckServiceTests : BaseTest<Module>
{
    private (LicenseCheckService Service, LicenseService License, ILicenseServerClient Server, ILicenseCacheStore Cache, MutableClock Clock)
        Build(LicenseCacheEntry? cached = null, string? jwt = null)
    {
        var clock = new MutableClock(new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero));
        var server = Substitute.For<ILicenseServerClient>();
        var cache = Substitute.For<ILicenseCacheStore>();
        cache.Load().Returns(cached);

        var effectiveJwt = jwt ?? Module.Factory.CreateJwt(tier: "Enterprise");
        var config = Module.Factory.Configuration(effectiveJwt);

        var services = GetServices(builder =>
        {
            builder.RegisterInstance(config).SingleInstance();
            builder.RegisterInstance(clock).As<IClock>().SingleInstance();
            builder.RegisterInstance(server).As<ILicenseServerClient>().SingleInstance();
            builder.RegisterInstance(cache).As<ILicenseCacheStore>().SingleInstance();
        });

        var license = services.GetRequiredService<LicenseService>();
        var checkService = services.GetRequiredService<LicenseCheckService>();

        return (checkService, license, server, cache, clock);
    }

    private static LicenseCheckResult Valid(IClock clock) =>
        new(LicenseCheckResult.Valid, null, null, clock.UtcNow);

    private static LicenseCheckResult Revoked(IClock clock) =>
        new(LicenseCheckResult.Revoked, null, null, clock.UtcNow);

    private static LicenseCheckResult Unknown(IClock clock) =>
        new(LicenseCheckResult.Unknown, null, null, clock.UtcNow);

    [TestMethod]
    public async Task ValidResult_StaysActive()
    {
        var (service, license, server, cache, clock) = Build();
        server.CheckAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Valid(clock));

        await service.RunCheckNowAsync(CancellationToken);

        license.Current.Status.Should().Be(LicenseStatus.Active);
        cache.Received().Save(Arg.Any<LicenseCacheEntry>());
    }

    [TestMethod]
    public async Task RevokedResult_DowngradesToExpired()
    {
        var (service, license, server, _, clock) = Build();
        server.CheckAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Revoked(clock));

        await service.RunCheckNowAsync(CancellationToken);

        license.Current.Status.Should().Be(LicenseStatus.Expired);
        license.Current.Tier.Should().Be(LicenseTier.Free);
        license.IsFeatureEnabled(LicenseFeature.AgenticEvaluators).Should().BeFalse();
    }

    [TestMethod]
    public async Task Unreachable_6Days_StaysActive()
    {
        var lastOk = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var (service, license, server, _, clock) = Build(new LicenseCacheEntry("jti", lastOk, "valid"));
        server.CheckAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Unknown(clock));

        clock.Advance(TimeSpan.FromDays(6));
        await service.RunCheckNowAsync(CancellationToken);

        license.Current.Status.Should().Be(LicenseStatus.Active);
    }

    [TestMethod]
    public async Task Unreachable_7Days_EntersGrace()
    {
        var lastOk = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var (service, license, server, _, clock) = Build(new LicenseCacheEntry("jti", lastOk, "valid"));
        server.CheckAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Unknown(clock));

        clock.Advance(TimeSpan.FromDays(7));
        await service.RunCheckNowAsync(CancellationToken);

        license.Current.Status.Should().Be(LicenseStatus.Grace);
        license.Current.GracePeriodEndsAt.Should().NotBeNull();
    }

    [TestMethod]
    public async Task Unreachable_14Days_DowngradesToFree()
    {
        var lastOk = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var (service, license, server, _, clock) = Build(new LicenseCacheEntry("jti", lastOk, "valid"));
        server.CheckAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Unknown(clock));

        clock.Advance(TimeSpan.FromDays(14));
        await service.RunCheckNowAsync(CancellationToken);

        license.Current.Status.Should().Be(LicenseStatus.Free);
        license.Current.Tier.Should().Be(LicenseTier.Free);
    }

    [TestMethod]
    public async Task ForceRefresh_TriggersImmediateCheck()
    {
        var (_, license, server, _, clock) = Build();
        server.CheckAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Revoked(clock));

        await license.ForceRefreshAsync(CancellationToken);

        await server.Received(1).CheckAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
        license.Current.Status.Should().Be(LicenseStatus.Expired);
    }
}
