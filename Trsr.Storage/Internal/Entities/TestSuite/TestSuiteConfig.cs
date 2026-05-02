using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Common.Serialization;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.Evaluator;
using Trsr.Domain.TestCase;
using Trsr.Domain.TestSuite;
using Trsr.Storage.Internal.Entities.Agent;
using Trsr.Storage.Internal.Entities.Evaluator;

namespace Trsr.Storage.Internal.Entities.TestSuite;

internal class TestSuiteConfig : AbstractEntityConfiguration<TestSuiteEntity>, IMapper<ITestSuite, TestSuiteEntity>
{
    private readonly IRepository<IAgent> agents;
    private readonly IRepository<IEvaluator> evaluators;
    private readonly IRepository<ITestCase> testCases;
    private readonly ITestSuite.CreateExisting factory;
    private readonly ISerializer serializer;

    public TestSuiteConfig(
        IRepository<IAgent> agents,
        IRepository<IEvaluator> evaluators,
        IRepository<ITestCase> testCases,
        ITestSuite.CreateExisting factory, 
        ISerializer serializer)
    {
        this.agents = agents;
        this.evaluators = evaluators;
        this.testCases = testCases;
        this.factory = factory;
        this.serializer = serializer;
    }

    public override void Configure(EntityTypeBuilder<TestSuiteEntity> builder)
    {
        builder
            .HasOne<AgentEntity>()
            .WithMany()
            .HasForeignKey(e => e.Agent)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne<EvaluatorEntity>()
            .WithMany()
            .HasForeignKey(e => e.Evaluator)
            .OnDelete(DeleteBehavior.Restrict);

        builder
            .Property(e => e.TestCases)
            .HasConversion(
                v => serializer.Serialize(v),
                v => serializer.Deserialize<IReadOnlyCollection<Guid>>(v) ?? Array.Empty<Guid>()
            );
    }

    public async Task<ITestSuite> Map(TestSuiteEntity storedEntity, CancellationToken cancellationToken = default)
        => factory(
            name: storedEntity.Name,
            agent: await agents.GetAsync(storedEntity.Agent, cancellationToken),
            evaluator: await evaluators.GetAsync(storedEntity.Evaluator, cancellationToken),
            testCases: await testCases.GetManyAsync(storedEntity.TestCases, cancellationToken),
            existing: storedEntity);

    public Task<TestSuiteEntity> Map(ITestSuite domainEntity, CancellationToken cancellationToken = default)
        => new TestSuiteEntity
        {
            Id = domainEntity.Id,
            Name = domainEntity.Name,
            Agent = domainEntity.Agent.Id,
            Evaluator = domainEntity.Evaluators.Id,
            TestCases = domainEntity.TestCases.Select(x => x.Id).ToArray(),
            CreatedAt = domainEntity.CreatedAt,
            UpdatedAt = domainEntity.UpdatedAt,
        }.ToTaskResult();
}
