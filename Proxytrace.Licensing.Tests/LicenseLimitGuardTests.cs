using AwesomeAssertions;
using NSubstitute;
using Proxytrace.Licensing.Exceptions;

namespace Proxytrace.Licensing.Tests;

[TestClass]
public sealed class LicenseLimitGuardTests
{
    public required TestContext TestContext { get; init; }

    private static ILicenseService ServiceWithLimit(LicenseLimit limit, long max)
    {
        var service = Substitute.For<ILicenseService>();
        service.GetLimit(limit).Returns(max);
        return service;
    }

    [TestMethod]
    public void Ensure_BelowLimit_DoesNotThrow()
    {
        var service = ServiceWithLimit(LicenseLimit.MaxUsers, 3);

        FluentActions.Invoking(() => LicenseLimitGuard.Ensure(service, LicenseLimit.MaxUsers, 2))
            .Should().NotThrow();
    }

    [TestMethod]
    public void Ensure_AtLimit_Throws()
    {
        var service = ServiceWithLimit(LicenseLimit.MaxUsers, 3);

        FluentActions.Invoking(() => LicenseLimitGuard.Ensure(service, LicenseLimit.MaxUsers, 3))
            .Should().Throw<LicenseLimitExceededException>()
            .Which.Max.Should().Be(3);
    }

    [TestMethod]
    public void Ensure_AboveLimit_Throws()
    {
        var service = ServiceWithLimit(LicenseLimit.MaxProjects, 1);

        FluentActions.Invoking(() => LicenseLimitGuard.Ensure(service, LicenseLimit.MaxProjects, 5))
            .Should().Throw<LicenseLimitExceededException>();
    }

    [TestMethod]
    public void Ensure_UnlimitedMaxValue_NeverThrows()
    {
        var service = ServiceWithLimit(LicenseLimit.MaxUsers, long.MaxValue);

        FluentActions.Invoking(() => LicenseLimitGuard.Ensure(service, LicenseLimit.MaxUsers, long.MaxValue - 1))
            .Should().NotThrow();
    }
}
