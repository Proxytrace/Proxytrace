using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Proxytrace.Application.Ingestion.Internal;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Licensing;
using Proxytrace.Testing;

namespace Proxytrace.Application.Tests.Ingestion;

[TestClass]
public sealed class TraceQuotaGuardTests : BaseTest<Module>
{
    private static IAgentCallRepository RepositoryWithTotal(int total)
    {
        var repo = Substitute.For<IAgentCallRepository>();
        repo.GetFilteredAsync(Arg.Any<AgentCallFilter>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<(IReadOnlyList<IAgentCall> Items, int Total)>(([], total)));
        return repo;
    }

    private (TraceQuotaGuard Guard, IAgentCallRepository Repo) BuildGuard(
        ILicenseService license, IAgentCallRepository repo)
    {
        var services = GetServices(b =>
        {
            b.RegisterInstance(license).As<ILicenseService>();
            b.RegisterInstance(repo).As<IAgentCallRepository>();
        });

        return (services.GetRequiredService<TraceQuotaGuard>(), repo);
    }

    private async Task WaitUntilAsync(Func<bool> condition)
    {
        var deadline = DateTimeOffset.UtcNow.AddSeconds(5);
        while (!condition() && DateTimeOffset.UtcNow < deadline)
            await Task.Delay(10, CancellationToken);
    }

    private static bool CountWasRead(IAgentCallRepository repo) => repo.ReceivedCalls().Any();

    [TestMethod]
    public async Task IsCurrentMonthOverQuota_WhenTotalAtLimit_ReturnsTrue()
    {
        var license = Substitute.For<ILicenseService>();
        license.GetLimit(LicenseLimit.MaxTracesPerMonth).Returns(5);
        var (guard, _) = BuildGuard(license, RepositoryWithTotal(5));

        await guard.StartAsync(CancellationToken);
        try
        {
            await WaitUntilAsync(() => guard.IsCurrentMonthOverQuota);
            guard.IsCurrentMonthOverQuota.Should().BeTrue();
        }
        finally
        {
            await guard.StopAsync(CancellationToken);
        }
    }

    [TestMethod]
    public async Task IsCurrentMonthOverQuota_WhenTotalBelowLimit_ReturnsFalse()
    {
        var license = Substitute.For<ILicenseService>();
        license.GetLimit(LicenseLimit.MaxTracesPerMonth).Returns(5);
        var (guard, repo) = BuildGuard(license, RepositoryWithTotal(3));

        await guard.StartAsync(CancellationToken);
        try
        {
            await WaitUntilAsync(() => CountWasRead(repo));
            guard.IsCurrentMonthOverQuota.Should().BeFalse();
        }
        finally
        {
            await guard.StopAsync(CancellationToken);
        }
    }

    [TestMethod]
    public async Task IsCurrentMonthOverQuota_WhenLimitUnlimited_ReturnsFalseWithoutCounting()
    {
        var license = Substitute.For<ILicenseService>();
        license.GetLimit(LicenseLimit.MaxTracesPerMonth).Returns(long.MaxValue);
        var (guard, repo) = BuildGuard(license, RepositoryWithTotal(int.MaxValue));

        // Unlimited tiers short-circuit before any await, so the first recompute completes
        // synchronously during StartAsync.
        await guard.StartAsync(CancellationToken);
        try
        {
            guard.IsCurrentMonthOverQuota.Should().BeFalse();
            await repo.DidNotReceive().GetFilteredAsync(
                Arg.Any<AgentCallFilter>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
        }
        finally
        {
            await guard.StopAsync(CancellationToken);
        }
    }
}
