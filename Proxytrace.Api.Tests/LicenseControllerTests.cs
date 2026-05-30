using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Proxytrace.Api.Controllers;
using Proxytrace.Application.Ingestion;
using Proxytrace.Licensing;
using Proxytrace.Testing;

namespace Proxytrace.Api.Tests;

[TestClass]
public sealed class LicenseControllerTests : BaseTest<Module>
{
    private static LicenseController ResolveController(IServiceProvider services, ILicenseService licenseService)
    {
        var quotaGuard = services.GetRequiredService<ITraceQuotaGuard>();
        return new LicenseController(licenseService, quotaGuard);
    }

    private static ILicenseService StubLicense(LicenseSnapshot snapshot)
    {
        var service = Substitute.For<ILicenseService>();
        service.Current.Returns(snapshot);
        service.IsFeatureEnabled(Arg.Any<LicenseFeature>())
            .Returns(call => snapshot.Features.Contains(call.Arg<LicenseFeature>()));
        service.GetLimit(Arg.Any<LicenseLimit>())
            .Returns(call => snapshot.Limits.TryGetValue(call.Arg<LicenseLimit>(), out var v) ? v : 0);
        return service;
    }

    [TestMethod]
    public void Get_FreeTier_ReturnsFreeDto()
    {
        var services = GetServices();
        var controller = ResolveController(services, StubLicense(LicenseSnapshot.Free()));

        var dto = controller.Get();

        dto.Tier.Should().Be("free");
        dto.Status.Should().Be("free");
        dto.Features.Should().BeEmpty();
        dto.Limits.Should().ContainKey(nameof(LicenseLimit.MaxProjects));
    }

    [TestMethod]
    public void Get_ActiveEnterprise_ReturnsEnterpriseDto()
    {
        var definition = LicensePolicy.For(LicenseTier.Enterprise);
        var snapshot = new LicenseSnapshot(
            LicenseTier.Enterprise,
            LicenseStatus.Active,
            DateTimeOffset.UtcNow.AddDays(30),
            null,
            "customer@example.com",
            "jti-1",
            definition.Features,
            definition.Limits);

        var services = GetServices();
        var dto = ResolveController(services, StubLicense(snapshot)).Get();

        dto.Tier.Should().Be("enterprise");
        dto.Status.Should().Be("active");
        dto.CustomerEmail.Should().Be("customer@example.com");
        dto.Features.Should().Contain(nameof(LicenseFeature.OptimizationProposals));
    }

    [TestMethod]
    public void Get_ExpiredStatus_ReturnsExpiredDto()
    {
        var snapshot = LicenseSnapshot.Free() with { Status = LicenseStatus.Expired };
        var services = GetServices();
        var dto = ResolveController(services, StubLicense(snapshot)).Get();

        dto.Status.Should().Be("expired");
    }

    [TestMethod]
    public async Task Refresh_CallsForceRefreshAndReturnsUpdatedDto()
    {
        var snapshot = LicenseSnapshot.Free();
        var licenseService = StubLicense(snapshot);

        var services = GetServices();
        var controller = ResolveController(services, licenseService);

        await controller.Refresh(CancellationToken);

        await licenseService.Received(1).ForceRefreshAsync(Arg.Any<CancellationToken>());
    }
}
