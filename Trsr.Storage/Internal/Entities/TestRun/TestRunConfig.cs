using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Common.Serialization;
using Trsr.Domain;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestSuite;
using Trsr.Storage.Internal.Entities.ModelEndpoint;
using Trsr.Storage.Internal.Entities.TestSuite;

namespace Trsr.Storage.Internal.Entities.TestRun;

internal class TestRunConfig : AbstractEntityConfiguration<TestRunEntity>, IMapper<ITestRun, TestRunEntity>
{
    private readonly IRepository<IModelEndpoint> endpoints;
    private readonly IRepository<ITestResult> testResults;
    private readonly IRepository<ITestSuite> suites;
    private readonly ITestRun.CreateExisting factory;
    private readonly ISerializer serializer;

    public TestRunConfig(
        IRepository<IModelEndpoint> endpoints,
        IRepository<ITestResult> testResults,
        IRepository<ITestSuite> suites,
        ITestRun.CreateExisting factory,
        ISerializer serializer)
    {
        this.endpoints = endpoints;
        this.testResults = testResults;
        this.suites = suites;
        this.factory = factory;
        this.serializer = serializer;
    }

    public override void Configure(EntityTypeBuilder<TestRunEntity> builder)
    {
        builder
            .HasOne<ModelEndpointEntity>()
            .WithMany()
            .HasForeignKey(e => e.Endpoint)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne<TestSuiteEntity>()
            .WithMany()
            .HasForeignKey(e => e.Suite)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .Property(e => e.TestResults)
            .HasConversion(
                v => serializer.Serialize(v),
                v => serializer.Deserialize<IReadOnlyCollection<Guid>>(v) ?? Array.Empty<Guid>()
            );
    }

    public async Task<ITestRun> Map(TestRunEntity stored, CancellationToken cancellationToken = default)
    {
        var suiteTask = suites.GetAsync(stored.Suite, cancellationToken);
        var endpointTask = endpoints.GetAsync(stored.Endpoint, cancellationToken);
        var resultsTask = testResults.GetManyAsync(stored.TestResults, cancellationToken);

        await Task.WhenAll(endpointTask, suiteTask, resultsTask);

        return factory(
            suite: suiteTask.Result,
            endpoint: endpointTask.Result,
            status: stored.Status,
            completedAt: stored.CompletedAt,
            testResults: resultsTask.Result,
            existing: stored);
    }

    public Task<TestRunEntity> Map(ITestRun domain, CancellationToken cancellationToken = default)
        => new TestRunEntity
        {
            Id = domain.Id,
            Suite = domain.Suite.Id,
            Endpoint = domain.Endpoint.Id,
            Status = domain.Status,
            CompletedAt = domain.CompletedAt,
            TestResults = domain.TestResults.Select(x => x.Id).ToArray(),
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}