using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Domain;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.TestResult;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;
using Proxytrace.Domain.TestSuite;
using Proxytrace.Testing;

namespace Proxytrace.Storage.Tests;

[TestClass]
public sealed class TestRunRepositoryTests : BaseTest<Module>
{
    [TestMethod]
    public async Task AddAsync_RoundTripsSampleIndex()
    {
        IServiceProvider services = GetServices();
        var groupGen = services.GetRequiredService<IDomainEntityGenerator<ITestRunGroup>>();
        var endpointGen = services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>();
        var runFactory = services.GetRequiredService<ITestRun.CreateNew>();
        var runRepo = services.GetRequiredService<ITestRunRepository>();

        var group = await groupGen.GetOrCreateAsync(CancellationToken);
        var endpoint = await endpointGen.GetOrCreateAsync(CancellationToken);

        var saved = await runRepo.AddAsync(runFactory(group, endpoint, sampleIndex: 3), CancellationToken);
        var reloaded = await runRepo.GetAsync(saved.Id, CancellationToken);

        reloaded.SampleIndex.Should().Be(3);
    }

    [TestMethod]
    public async Task GetByAgentPaged_ByDefault_ExcludesRunsOfSystemGroups()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<ITestRunRepository>();
        var (suite, userRun, _) = await PersistUserAndSystemRuns(services);

        var page = await repo.GetByAgentPagedAsync(suite.Agent.Id, page: 1, pageSize: 50, cancellationToken: CancellationToken);

        page.Items.Should().ContainSingle().Which.Id.Should().Be(userRun.Id);
    }

    [TestMethod]
    public async Task GetByAgentPaged_WithIncludeSystem_ReturnsRunsOfSystemGroups()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<ITestRunRepository>();
        var (suite, userRun, systemRun) = await PersistUserAndSystemRuns(services);

        var page = await repo.GetByAgentPagedAsync(suite.Agent.Id, page: 1, pageSize: 50, includeSystem: true, CancellationToken);

        page.Items.Select(r => r.Id).Should().BeEquivalentTo([userRun.Id, systemRun.Id]);
    }

    [TestMethod]
    public async Task GetAllPaged_ByDefault_ExcludesRunsOfSystemGroups()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<ITestRunRepository>();
        var (_, userRun, _) = await PersistUserAndSystemRuns(services);

        var page = await repo.GetAllPagedAsync(page: 1, pageSize: 50, cancellationToken: CancellationToken);

        page.Items.Should().ContainSingle().Which.Id.Should().Be(userRun.Id);
    }

    [TestMethod]
    public async Task GetAllPaged_WithIncludeSystem_ReturnsRunsOfSystemGroups()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<ITestRunRepository>();
        var (_, userRun, systemRun) = await PersistUserAndSystemRuns(services);

        var page = await repo.GetAllPagedAsync(page: 1, pageSize: 50, includeSystem: true, CancellationToken);

        page.Items.Select(r => r.Id).Should().BeEquivalentTo([userRun.Id, systemRun.Id]);
    }

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

    /// <summary>
    /// Seeds one user (non-system) run and one system run under the same suite/agent, so a test can
    /// assert the system-run filter on either listing method.
    /// </summary>
    private async Task<(ITestSuite Suite, ITestRun UserRun, ITestRun SystemRun)> PersistUserAndSystemRuns(
        IServiceProvider services)
    {
        var suiteGen = services.GetRequiredService<IDomainEntityGenerator<ITestSuite>>();
        var endpointGen = services.GetRequiredService<IDomainEntityGenerator<IModelEndpoint>>();
        var groupFactory = services.GetRequiredService<ITestRunGroup.CreateNew>();
        var runFactory = services.GetRequiredService<ITestRun.CreateNew>();
        var groupRepo = services.GetRequiredService<ITestRunGroupRepository>();
        var runRepo = services.GetRequiredService<ITestRunRepository>();

        var suite = await suiteGen.CreateAsync(CancellationToken);
        var endpoint = await endpointGen.GetOrCreateAsync(CancellationToken);

        var userGroup = await groupRepo.AddAsync(groupFactory(suite, isSystemRun: false, null, sampleCount: 1), CancellationToken);
        var systemGroup = await groupRepo.AddAsync(groupFactory(suite, isSystemRun: true, null, sampleCount: 1), CancellationToken);
        var userRun = await runRepo.AddAsync(runFactory(userGroup, endpoint, sampleIndex: 0), CancellationToken);
        var systemRun = await runRepo.AddAsync(runFactory(systemGroup, endpoint, sampleIndex: 0), CancellationToken);

        return (suite, userRun, systemRun);
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

        var run = runFactory(group, endpoint, sampleIndex: 0);
        run = await runRepo.AddAsync(run, CancellationToken);
        // SetTestResult self-persists (domain transition), so the run row already exists.
        run = await run.SetTestResult(result, CancellationToken);

        return (run, result.Id);
    }
}
