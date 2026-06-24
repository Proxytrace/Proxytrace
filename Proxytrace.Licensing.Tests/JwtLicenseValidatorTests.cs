using System.Security.Claims;
using AwesomeAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Proxytrace.Licensing.Exceptions;
using Proxytrace.Licensing.Internal;

namespace Proxytrace.Licensing.Tests;

[TestClass]
public sealed class JwtLicenseValidatorTests
{
    public required TestContext TestContext { get; init; }

    private readonly TestLicenseFactory factory = new();

    [TestCleanup]
    public void Teardown() => factory.Dispose();

    private JwtLicenseValidator CreateValidator()
        => new(factory.Configuration(), NullLogger<JwtLicenseValidator>.Instance);

    [TestMethod]
    public void Validate_ValidEnterpriseToken_ReturnsActiveSnapshot()
    {
        var jwt = factory.CreateJwt(tier: "Enterprise");

        var snapshot = CreateValidator().Validate(jwt);

        snapshot.Tier.Should().Be(LicenseTier.Enterprise);
        snapshot.Status.Should().Be(LicenseStatus.Active);
        snapshot.CustomerEmail.Should().Be("customer@example.com");
        snapshot.Features.Should().Contain(LicenseFeature.OptimizationProposals);
        snapshot.Jti.Should().NotBeNullOrEmpty();
    }

    [TestMethod]
    public void Validate_LegacyRs256Token_StillValidates()
    {
        // Backward compatibility: keys/licenses from before the ES256 migration must keep working.
        using var rsaFactory = new TestLicenseFactory(useEcdsa: false);
        var jwt = rsaFactory.CreateJwt(tier: "Enterprise");
        var validator = new JwtLicenseValidator(
            rsaFactory.Configuration(), NullLogger<JwtLicenseValidator>.Instance);

        var snapshot = validator.Validate(jwt);

        snapshot.Tier.Should().Be(LicenseTier.Enterprise);
        snapshot.Status.Should().Be(LicenseStatus.Active);
    }

    [TestMethod]
    public void Validate_ExpiredToken_ThrowsExpired()
    {
        var jwt = factory.CreateJwt(expires: DateTimeOffset.UtcNow.AddMinutes(-1));

        FluentActions.Invoking(() => CreateValidator().Validate(jwt))
            .Should().Throw<InvalidLicenseException>()
            .Which.Reason.Should().Be(InvalidLicenseReason.Expired);
    }

    [TestMethod]
    public void Validate_WrongIssuer_ThrowsWrongIssuer()
    {
        var jwt = factory.CreateJwt(issuer: "https://evil.example.com");

        FluentActions.Invoking(() => CreateValidator().Validate(jwt))
            .Should().Throw<InvalidLicenseException>()
            .Which.Reason.Should().Be(InvalidLicenseReason.WrongIssuer);
    }

    [TestMethod]
    public void Validate_WrongAudience_ThrowsWrongAudience()
    {
        var jwt = factory.CreateJwt(audience: "someone-else");

        FluentActions.Invoking(() => CreateValidator().Validate(jwt))
            .Should().Throw<InvalidLicenseException>()
            .Which.Reason.Should().Be(InvalidLicenseReason.WrongAudience);
    }

    [TestMethod]
    public void Validate_TamperedSignature_ThrowsBadSignature()
    {
        // Signed with a different key than the validator is configured to trust.
        var jwt = factory.CreateJwt(sign: false);

        FluentActions.Invoking(() => CreateValidator().Validate(jwt))
            .Should().Throw<InvalidLicenseException>()
            .Which.Reason.Should().Be(InvalidLicenseReason.BadSignature);
    }

    [TestMethod]
    public void Validate_Garbage_ThrowsMalformed()
    {
        FluentActions.Invoking(() => CreateValidator().Validate("not-a-jwt"))
            .Should().Throw<InvalidLicenseException>()
            .Which.Reason.Should().Be(InvalidLicenseReason.Malformed);
    }

    [TestMethod]
    public void Validate_UnknownTier_FallsBackToFreeDefinition()
    {
        var jwt = factory.CreateJwt(tier: "Platinum");

        var snapshot = CreateValidator().Validate(jwt);

        snapshot.Tier.Should().Be(LicenseTier.Free);
        snapshot.Limits[LicenseLimit.MaxProjects].Should().Be(1);
    }

    [TestMethod]
    public void Validate_FeatureOverlay_AddsFeatureToFreeTier()
    {
        var jwt = factory.CreateJwt(tier: "Free", features: ["AuditLog"]);

        var snapshot = CreateValidator().Validate(jwt);

        snapshot.Features.Should().Contain(LicenseFeature.AuditLog);
    }

    [TestMethod]
    public void Validate_LimitOverlay_OverridesDefaultLimit()
    {
        var jwt = factory.CreateJwt(tier: "Free", limits: ["MaxUsers=50"]);

        var snapshot = CreateValidator().Validate(jwt);

        snapshot.Limits[LicenseLimit.MaxUsers].Should().Be(50);
    }

    [TestMethod]
    public void Validate_OfflineClaimTrue_SnapshotIsOffline()
    {
        var jwt = factory.CreateJwt(tier: "Enterprise", offline: true);

        var snapshot = CreateValidator().Validate(jwt);

        snapshot.Offline.Should().BeTrue();
        snapshot.Tier.Should().Be(LicenseTier.Enterprise);
        snapshot.Status.Should().Be(LicenseStatus.Active);
    }

    [TestMethod]
    public void Validate_NoOfflineClaim_SnapshotIsOnline()
    {
        // A normal mint omits the claim entirely; that must read as online (not offline).
        var jwt = factory.CreateJwt(tier: "Enterprise");

        var snapshot = CreateValidator().Validate(jwt);

        snapshot.Offline.Should().BeFalse();
    }

    [TestMethod]
    public void Validate_OfflineClaimFalse_SnapshotIsOnline()
    {
        // Defensive: the server never emits offline:false, but the client must not break on it.
        var jwt = factory.CreateJwt(tier: "Enterprise", offline: false);

        var snapshot = CreateValidator().Validate(jwt);

        snapshot.Offline.Should().BeFalse();
    }

    [TestMethod]
    public void Validate_OfflineClaimJsonString_TreatedAsOnline()
    {
        // The contract is "JSON boolean true" matched by type — a quoted string "true" is NOT a
        // boolean, so it must read as online. This pins the "do not string-match" requirement.
        var jwt = factory.CreateJwt(tier: "Enterprise", offlineRaw: ("true", ClaimValueTypes.String));

        var snapshot = CreateValidator().Validate(jwt);

        snapshot.Offline.Should().BeFalse();
    }

    [TestMethod]
    public void Validate_OfflineClaimNumber_TreatedAsOnline()
    {
        // A numeric (or any non-boolean) offline claim must not flip the install offline.
        var jwt = factory.CreateJwt(tier: "Enterprise", offlineRaw: ("1", ClaimValueTypes.Integer));

        var snapshot = CreateValidator().Validate(jwt);

        snapshot.Offline.Should().BeFalse();
    }
}
