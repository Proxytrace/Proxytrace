using AwesomeAssertions;
using Proxytrace.Api.Controllers;
using Proxytrace.Application.Ingestion;
using Proxytrace.Licensing;

namespace Proxytrace.Api.Tests;

[TestClass]
public sealed class LicenseControllerTests
{
    private sealed class StubLicenseService : ILicenseService
    {
        private readonly LicenseSnapshot snapshot;

        public StubLicenseService(LicenseSnapshot snapshot) => this.snapshot = snapshot;

        public LicenseSnapshot Current => snapshot;
        public event Action? Changed;
        public bool IsFeatureEnabled(LicenseFeature feature) => snapshot.Features.Contains(feature);
        public long GetLimit(LicenseLimit limit) => snapshot.Limits.TryGetValue(limit, out var v) ? v : 0;

        public Task ForceRefreshAsync(CancellationToken cancellationToken = default)
        {
            Changed?.Invoke();
            return Task.CompletedTask;
        }
    }

    private sealed class StubQuotaGuard : ITraceQuotaGuard
    {
        public bool IsCurrentMonthOverQuota => false;
    }

    private static LicenseController Build(LicenseSnapshot snapshot) =>
        new(new StubLicenseService(snapshot), new StubQuotaGuard());

    [TestMethod]
    public void Get_FreeTier_ReturnsFreeDto()
    {
        var controller = Build(LicenseSnapshot.Free());

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

        var dto = Build(snapshot).Get();

        dto.Tier.Should().Be("enterprise");
        dto.Status.Should().Be("active");
        dto.CustomerEmail.Should().Be("customer@example.com");
        dto.Features.Should().Contain(nameof(LicenseFeature.OptimizationProposals));
    }

    [TestMethod]
    public void Get_Expired_ReturnsExpiredStatus()
    {
        var snapshot = LicenseSnapshot.Free() with { Status = LicenseStatus.Expired };

        var dto = Build(snapshot).Get();

        dto.Status.Should().Be("expired");
    }
}
