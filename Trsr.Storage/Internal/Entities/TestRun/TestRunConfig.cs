using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Common.Serialization;
using Trsr.Domain;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestRunGroup;
using Trsr.Domain.Usage;
using Trsr.Storage.Internal.Entities.ModelEndpoint;
using Trsr.Storage.Internal.Entities.TestRunGroup;
using TestRunStatistics = Trsr.Domain.TestRun.TestRunStatistics;

namespace Trsr.Storage.Internal.Entities.TestRun;

internal class TestRunConfig : AbstractEntityConfiguration<TestRunEntity>, IMapper<ITestRun, TestRunEntity>
{
    private readonly IRepository<IModelEndpoint> endpoints;
    private readonly IRepository<ITestResult> testResults;
    private readonly IRepository<ITestRunGroup> groups;
    private readonly ITestRun.CreateExisting factory;
    private readonly ISerializer serializer;

    public TestRunConfig(
        IRepository<IModelEndpoint> endpoints,
        IRepository<ITestResult> testResults,
        IRepository<ITestRunGroup> groups,
        ITestRun.CreateExisting factory,
        ISerializer serializer)
    {
        this.endpoints = endpoints;
        this.testResults = testResults;
        this.groups = groups;
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
            .HasOne<TestRunGroupEntity>()
            .WithMany()
            .HasForeignKey(e => e.Group)
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
        var groupTask = groups.GetAsync(stored.Group, cancellationToken);
        var endpointTask = endpoints.GetAsync(stored.Endpoint, cancellationToken);
        var resultsTask = testResults.GetManyAsync(stored.TestResults, cancellationToken);

        await Task.WhenAll(groupTask, endpointTask, resultsTask);

        TestRunStatistics statistics = new TestRunStatistics(
            TestCases: stored.StatTestCases,
            Passed: stored.StatPassed,
            Usage: stored is {StatInputTokens: not null, StatOutputTokens: not null} 
                ? new TokenUsage((ulong)stored.StatInputTokens.Value, (ulong)stored.StatOutputTokens.Value)
                : null,
            Latency: stored.StatTotalDurationMs.HasValue 
                ? TimeSpan.FromMilliseconds(stored.StatTotalDurationMs.Value)
                : null,
            Cost: stored.StatCost);

        return factory(
            group: groupTask.Result,
            endpoint: endpointTask.Result,
            status: stored.Status,
            completedAt: stored.CompletedAt,
            testResults: resultsTask.Result,
            statistics: statistics,
            existing: stored);
    }

    public Task<TestRunEntity> Map(ITestRun domain, CancellationToken cancellationToken = default)
        => new TestRunEntity
        {
            Id = domain.Id,
            Group = domain.Group.Id,
            Endpoint = domain.Endpoint.Id,
            Status = domain.Status,
            CompletedAt = domain.CompletedAt,
            TestResults = domain.TestResults.Select(x => x.Id).ToArray(),
            StatTestCases = domain.Statistics.TestCases,
            StatPassed = domain.Statistics.Passed,
            StatInputTokens = (long?)domain.Statistics.Usage?.InputTokenCount,
            StatOutputTokens = (long?)domain.Statistics.Usage?.OutputTokenCount,
            StatTotalDurationMs = (long?)domain.Statistics.Latency?.TotalMilliseconds,
            StatCost = domain.Statistics.Cost,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}
