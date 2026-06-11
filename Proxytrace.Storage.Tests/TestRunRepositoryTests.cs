using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Domain;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.TestResult;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;
using Proxytrace.Testing;

namespace Proxytrace.Storage.Tests;

[TestClass]
public sealed class TestRunRepositoryTests : BaseTest<Module>
{
    [TestMethod]
    public async Task GetRunIdsByResultIds_WhenResultBelongsToRun_MapsToRunId()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<ITestRunRepository>();
        var (run, resultId) = await PersistRunWithResult(services);

        var map = await repo.GetRunIdsByResultIdsAsync([resultId], CancellationToken);

        map.Should().ContainKey(resultId);
        map[resultId].Should().Be(run.Id);
    }

    [TestMethod]
    public async Task GetRunIdsByResultIds_WhenResultUnknown_OmitsFromMap()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<ITestRunRepository>();
        await PersistRunWithResult(services);

        var map = await repo.GetRunIdsByResultIdsAsync([Guid.NewGuid()], CancellationToken);

        map.Should().BeEmpty();
    }

    [TestMethod]
    public async Task GetRunIdsByResultIds_WhenEmptyInput_ReturnsEmpty()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<ITestRunRepository>();

        var map = await repo.GetRunIdsByResultIdsAsync([], CancellationToken);

        map.Should().BeEmpty();
    }

    private async Task<(ITestRun Run, Guid ResultId)> PersistRunWithResult(IServiceProvider services)
    {
        var groupGen = services.GetRequiredService<IDomainEntityGenerator<ITestRunGroup>>();
        var endpointGen = services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>();
        var resultGen = services.GetRequiredService<ITestResultGenerator>();
        var runFactory = services.GetRequiredService<ITestRun.CreateNew>();
        var runRepo = services.GetRequiredService<ITestRunRepository>();

        var group = await groupGen.GetOrCreateAsync(CancellationToken);
        var endpoint = await endpointGen.GetOrCreateAsync(CancellationToken);
        var testCase = group.Suite.TestCases.First();
        var result = await resultGen.CreateAsync(testCase, CancellationToken);

        var run = runFactory(group, endpoint);
        run = await runRepo.AddAsync(run, CancellationToken);
        // SetTestResult self-persists (domain transition), so the run row already exists.
        run = await run.SetTestResult(result, CancellationToken);

        return (run, result.Id);
    }
}
