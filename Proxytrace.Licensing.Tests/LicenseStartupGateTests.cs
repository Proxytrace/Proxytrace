using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Proxytrace.Common.Async;
using Proxytrace.Licensing.Exceptions;
using Proxytrace.Licensing.Internal;
using Proxytrace.Testing;

namespace Proxytrace.Licensing.Tests;

[TestClass]
public sealed class LicenseStartupGateTests : BaseTest<Module>
{
    /// <summary>
    /// Constructs a <see cref="LicenseService"/> in isolation with the given configuration,
    /// bypassing AutoActivate so we can assert directly on startup-gate outcomes.
    /// </summary>
    private static LicenseService Create(LicensingConfiguration config)
    {
        var validator = new JwtLicenseValidator(config, NullLogger<JwtLicenseValidator>.Instance);
        var trigger = Substitute.For<ILicenseRefreshTrigger>();
        return new LicenseService(config, validator, NoOpLock(), () => trigger, NullLogger<LicenseService>.Instance);
    }

    private static IAsyncLock NoOpLock()
    {
        var gate = Substitute.For<IAsyncLock>();
        gate.Lock(Arg.Any<object>()).Returns(Substitute.For<IDisposable>());
        gate.LockAsync(Arg.Any<object>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(Substitute.For<IDisposable>()));
        return gate;
    }

    [TestMethod]
    public void Construct_NoJwt_RunsFree()
    {
        var service = Create(Module.Factory.Configuration(jwt: null));

        service.Current.Tier.Should().Be(LicenseTier.Free);
        service.Current.Status.Should().Be(LicenseStatus.Free);
    }

    [TestMethod]
    public void Construct_ValidJwt_RunsActive()
    {
        var service = Create(Module.Factory.Configuration(Module.Factory.CreateJwt(tier: "Enterprise")));

        service.Current.Tier.Should().Be(LicenseTier.Enterprise);
        service.Current.Status.Should().Be(LicenseStatus.Active);
        service.IsFeatureEnabled(LicenseFeature.AgenticEvaluators).Should().BeTrue();
    }

    [TestMethod]
    public void Construct_MalformedJwt_Throws()
        => FluentActions.Invoking(() => Create(Module.Factory.Configuration("garbage")))
            .Should().Throw<InvalidLicenseException>()
            .Which.Reason.Should().Be(InvalidLicenseReason.Malformed);

    [TestMethod]
    public void Construct_BadSignature_Throws()
        => FluentActions.Invoking(() => Create(Module.Factory.Configuration(Module.Factory.CreateJwt(sign: false))))
            .Should().Throw<InvalidLicenseException>()
            .Which.Reason.Should().Be(InvalidLicenseReason.BadSignature);

    [TestMethod]
    public void Construct_WrongIssuer_Throws()
        => FluentActions.Invoking(() => Create(Module.Factory.Configuration(Module.Factory.CreateJwt(issuer: "https://evil.example.com"))))
            .Should().Throw<InvalidLicenseException>()
            .Which.Reason.Should().Be(InvalidLicenseReason.WrongIssuer);

    [TestMethod]
    public void Construct_WrongAudience_Throws()
        => FluentActions.Invoking(() => Create(Module.Factory.Configuration(Module.Factory.CreateJwt(audience: "nope"))))
            .Should().Throw<InvalidLicenseException>()
            .Which.Reason.Should().Be(InvalidLicenseReason.WrongAudience);

    [TestMethod]
    public void Construct_ExpiredJwt_Throws()
        => FluentActions.Invoking(() => Create(Module.Factory.Configuration(Module.Factory.CreateJwt(expires: DateTimeOffset.UtcNow.AddMinutes(-1)))))
            .Should().Throw<InvalidLicenseException>()
            .Which.Reason.Should().Be(InvalidLicenseReason.Expired);

    [TestMethod]
    public async Task ForceRefresh_DelegatesToRefreshTrigger()
    {
        var trigger = Substitute.For<ILicenseRefreshTrigger>();
        var config = Module.Factory.Configuration(Module.Factory.CreateJwt());
        var validator = new JwtLicenseValidator(config, NullLogger<JwtLicenseValidator>.Instance);
        var service = new LicenseService(config, validator, NoOpLock(), () => trigger, NullLogger<LicenseService>.Instance);

        await service.ForceRefreshAsync(CancellationToken);

        await trigger.Received(1).RunCheckNowAsync(Arg.Any<CancellationToken>());
    }

    [TestMethod]
    public void GetServices_FreeTier_LicenseServiceResolvesToFree()
    {
        var services = GetServices();
        var licenseService = services.GetRequiredService<ILicenseService>();

        licenseService.Current.Status.Should().Be(LicenseStatus.Free);
    }

    [TestMethod]
    public void GetServices_WithEnterpriseJwt_LicenseServiceResolvesToActive()
    {
        var jwt = Module.Factory.CreateJwt(tier: "Enterprise");
        var config = Module.Factory.Configuration(jwt);

        var services = GetServices(builder =>
            builder.RegisterInstance(config).SingleInstance());

        var licenseService = services.GetRequiredService<ILicenseService>();
        licenseService.Current.Status.Should().Be(LicenseStatus.Active);
        licenseService.IsFeatureEnabled(LicenseFeature.OptimizationProposals).Should().BeTrue();
    }
}
