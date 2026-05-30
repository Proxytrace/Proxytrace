using AwesomeAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Proxytrace.Licensing.Exceptions;
using Proxytrace.Licensing.Internal;

namespace Proxytrace.Licensing.Tests;

[TestClass]
public sealed class LicenseStartupGateTests
{
    private readonly TestLicenseFactory factory = new();

    [TestCleanup]
    public void Teardown() => factory.Dispose();

    private LicenseService Create(string? jwt)
    {
        var config = factory.Configuration(jwt);
        var validator = new JwtLicenseValidator(config, NullLogger<JwtLicenseValidator>.Instance);
        var trigger = Substitute.For<ILicenseRefreshTrigger>();
        return new LicenseService(config, validator, () => trigger, NullLogger<LicenseService>.Instance);
    }

    [TestMethod]
    public void Construct_NoJwt_RunsFree()
    {
        var service = Create(jwt: null);

        service.Current.Tier.Should().Be(LicenseTier.Free);
        service.Current.Status.Should().Be(LicenseStatus.Free);
    }

    [TestMethod]
    public void Construct_ValidJwt_RunsActive()
    {
        var service = Create(factory.CreateJwt(tier: "Enterprise"));

        service.Current.Tier.Should().Be(LicenseTier.Enterprise);
        service.Current.Status.Should().Be(LicenseStatus.Active);
        service.IsFeatureEnabled(LicenseFeature.AgenticEvaluators).Should().BeTrue();
    }

    [TestMethod]
    public void Construct_MalformedJwt_Throws()
        => FluentActions.Invoking(() => Create("garbage"))
            .Should().Throw<InvalidLicenseException>()
            .Which.Reason.Should().Be(InvalidLicenseReason.Malformed);

    [TestMethod]
    public void Construct_BadSignature_Throws()
        => FluentActions.Invoking(() => Create(factory.CreateJwt(sign: false)))
            .Should().Throw<InvalidLicenseException>()
            .Which.Reason.Should().Be(InvalidLicenseReason.BadSignature);

    [TestMethod]
    public void Construct_WrongIssuer_Throws()
        => FluentActions.Invoking(() => Create(factory.CreateJwt(issuer: "https://evil.example.com")))
            .Should().Throw<InvalidLicenseException>()
            .Which.Reason.Should().Be(InvalidLicenseReason.WrongIssuer);

    [TestMethod]
    public void Construct_WrongAudience_Throws()
        => FluentActions.Invoking(() => Create(factory.CreateJwt(audience: "nope")))
            .Should().Throw<InvalidLicenseException>()
            .Which.Reason.Should().Be(InvalidLicenseReason.WrongAudience);

    [TestMethod]
    public void Construct_ExpiredJwt_Throws()
        => FluentActions.Invoking(() => Create(factory.CreateJwt(expires: DateTimeOffset.UtcNow.AddMinutes(-1))))
            .Should().Throw<InvalidLicenseException>()
            .Which.Reason.Should().Be(InvalidLicenseReason.Expired);

    [TestMethod]
    public async Task ForceRefresh_DelegatesToRefreshTrigger()
    {
        var config = factory.Configuration(factory.CreateJwt());
        var validator = new JwtLicenseValidator(config, NullLogger<JwtLicenseValidator>.Instance);
        var trigger = Substitute.For<ILicenseRefreshTrigger>();
        var service = new LicenseService(config, validator, () => trigger, NullLogger<LicenseService>.Instance);

        await service.ForceRefreshAsync(CancellationToken.None);

        await trigger.Received(1).RunCheckNowAsync(Arg.Any<CancellationToken>());
    }
}
