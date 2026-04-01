using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Common.Serialization;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestRun;
using Trsr.Storage.Internal.Entities.Agent;

namespace Trsr.Storage.Internal.Entities.TestRun;

internal class TestRunConfig : AbstractEntityConfiguration<TestRunEntity>, IMapper<ITestRun, TestRunEntity>
{
    private readonly IRepository<IAgent> agents;
    private readonly IRepository<ITestResult> testResults;
    private readonly ITestRun.CreateExisting factory;
    private readonly ISerializer serializer;

    public TestRunConfig(
        IRepository<IAgent> agents,
        IRepository<ITestResult> testResults,
        ITestRun.CreateExisting factory,
        ISerializer serializer)
    {
        this.agents = agents;
        this.testResults = testResults;
        this.factory = factory;
        this.serializer = serializer;
    }

    public override void Configure(EntityTypeBuilder<TestRunEntity> builder)
    {
        builder
            .HasOne<AgentEntity>()
            .WithMany()
            .HasForeignKey(e => e.Agent)
            .OnDelete(DeleteBehavior.Restrict);

        builder
            .Property(e => e.TestResults)
            .HasConversion(
                v => serializer.Serialize(v),
                v => serializer.Deserialize<IReadOnlyCollection<Guid>>(v) ?? Array.Empty<Guid>()
            );
    }

    public async Task<ITestRun> Map(TestRunEntity stored, CancellationToken cancellationToken = default)
        => factory(
            timestamp: stored.Timestamp,
            agent: await agents.GetAsync(stored.Agent, cancellationToken),
            testResults: await testResults.GetManyAsync(stored.TestResults, cancellationToken),
            existing: stored);

    public Task<TestRunEntity> Map(ITestRun domain, CancellationToken cancellationToken = default)
        => new TestRunEntity
        {
            Id = domain.Id,
            Timestamp = domain.Timestamp,
            Agent = domain.Agent.Id,
            TestResults = domain.TestResults.Select(x => x.Id).ToArray(),
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}
