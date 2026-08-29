using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Nordstein.Core.Testing;

namespace Proxytrace.Licensing.Tests;

/// <summary>
/// Startup resolution through the full product wiring: the Proxytrace module parameterizes the
/// Nordstein.Core engine with the product policy, and the engine resolves the configured
/// license synchronously at container build. These tests pin the product-visible outcomes —
/// enum-typed tiers and statuses — of that resolution, including that an invalid configured
/// license never crashes the host.
/// </summary>
[TestClass]
public sealed class LicenseStartupGateTests : BaseTest<Module>
{
    private ILicenseService Create(string? jwt)
    {
        var services = GetServices(builder =>
            builder.RegisterInstance(Module.Factory.Configuration(jwt)).SingleInstance());
        return services.GetRequiredService<ILicenseService>();
    }

    [TestMethod]
    public void Construct_NoJwt_RunsFree()
    {
        var service = Create(jwt: null);

        service.Current.Tier.Should().Be(LicenseTier.Free);
        service.Current.Status.Should().Be(LicenseStatus.Free);
        service.Current.Source.Should().Be(LicenseSource.None);
    }

    [TestMethod]
    public void Construct_ValidJwt_RunsActive()
    {
        var service = Create(Module.Factory.CreateJwt(tier: "Enterprise"));

        service.Current.Tier.Should().Be(LicenseTier.Enterprise);
        service.Current.Status.Should().Be(LicenseStatus.Active);
        service.Current.Source.Should().Be(LicenseSource.Environment);
    }

    [TestMethod]
    public void Construct_MalformedJwt_DegradesToInvalidFree()
        => AssertInvalid(Create("garbage"));

    [TestMethod]
    public void Construct_BadSignature_DegradesToInvalidFree()
        => AssertInvalid(Create(Module.Factory.CreateJwt(sign: false)));

    [TestMethod]
    public void Construct_WrongIssuer_DegradesToInvalidFree()
        => AssertInvalid(Create(Module.Factory.CreateJwt(issuer: "https://evil.example.com")));

    [TestMethod]
    public void Construct_WrongAudience_DegradesToInvalidFree()
        => AssertInvalid(Create(Module.Factory.CreateJwt(audience: "nope")));

    [TestMethod]
    public void Construct_ExpiredJwt_DegradesToInvalidFree()
        => AssertInvalid(Create(Module.Factory.CreateJwt(expires: DateTimeOffset.UtcNow.AddMinutes(-1))));

    /// <summary>
    /// An invalid configured license must never crash the host: it boots as Free with
    /// LicenseStatus.Invalid and the rejection reason for the UI.
    /// </summary>
    private static void AssertInvalid(ILicenseService service)
    {
        service.Current.Tier.Should().Be(LicenseTier.Free);
        service.Current.Status.Should().Be(LicenseStatus.Invalid);
        service.Current.Source.Should().Be(LicenseSource.Environment);
        service.Current.InvalidReason.Should().NotBeNullOrEmpty();
    }

    [TestMethod]
    public void Construct_LegacyFeatureAndLimitClaims_AreIgnored()
    {
        // Keys issued while Proxytrace still gated features carry `feat`/`lim` claims. The
        // product no longer has that vocabulary, so the engine must drop them (with a warning)
        // instead of rejecting an otherwise valid support key.
        var jwt = Module.Factory.CreateJwt(
            tier: "Enterprise",
            features: ["AuditLog", "Tracey"],
            limits: ["MaxUsers=50"]);

        var service = Create(jwt);

        service.Current.Tier.Should().Be(LicenseTier.Enterprise);
        service.Current.Status.Should().Be(LicenseStatus.Active);
    }

    [TestMethod]
    public void Construct_UndefinedNumericTierClaim_FallsBackToFree()
    {
        // Divergence pinned deliberately: the old enum parsing accepted ANY numeric tier claim,
        // so a signed `tier: "50"` produced the undefined (LicenseTier)50. The policy now
        // requires a defined member; undefined values fall back to Free.
        var service = Create(Module.Factory.CreateJwt(tier: "50"));

        service.Current.Tier.Should().Be(LicenseTier.Free);
    }

    [TestMethod]
    public void Construct_NumericAliasOfDefinedTier_StillResolves()
    {
        // Unchanged behavior, made explicit: a numeric spelling of a defined member remains a
        // valid wire value ("100" == LicenseTier.Enterprise), exactly as Enum.TryParse always
        // accepted it.
        var service = Create(Module.Factory.CreateJwt(tier: "100"));

        service.Current.Tier.Should().Be(LicenseTier.Enterprise);
    }

    [TestMethod]
    public void Construct_OfflineClaim_SurfacesOnSnapshot()
    {
        var jwt = Module.Factory.CreateJwt(tier: "Enterprise", offline: true);

        var service = Create(jwt);

        service.Current.Offline.Should().BeTrue();
        service.Current.Tier.Should().Be(LicenseTier.Enterprise);
    }
}
