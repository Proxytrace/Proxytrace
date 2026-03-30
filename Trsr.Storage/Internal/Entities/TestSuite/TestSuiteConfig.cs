using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Serialization;
using Trsr.Domain.TestSuite;
using Trsr.Storage.Internal.Entities.Agent;

namespace Trsr.Storage.Internal.Entities.TestSuite;

internal class TestSuiteConfig : AbstractEntityConfiguration<TestSuiteEntity>, IMapper<ITestSuite, TestSuiteEntity>
{
    private readonly ITestSuite.CreateExisting factory;
    private readonly ISerializer serializer;

    public TestSuiteConfig(ITestSuite.CreateExisting factory, ISerializer serializer)
    {
        this.factory = factory;
        this.serializer = serializer;
    }

    public override void Configure(EntityTypeBuilder<TestSuiteEntity> builder)
    {
        builder
            .HasOne<AgentEntity>()
            .WithMany()
            .HasForeignKey(e => e.Agent)
            .OnDelete(DeleteBehavior.Restrict);

        builder
            .Property(e => e.TestCases)
            .HasConversion(
                v => serializer.Serialize(v),
                v => serializer.Deserialize<IReadOnlyCollection<Guid>>(v) ?? Array.Empty<Guid>()
            );
    }

    public ITestSuite Map(TestSuiteEntity storedEntity)
        => factory(storedEntity);

    public TestSuiteEntity Map(ITestSuite domainEntity)
        => new()
        {
            Id = domainEntity.Id,
            Agent = domainEntity.Agent,
            TestCases = domainEntity.TestCases,
            CreatedAt = domainEntity.CreatedAt,
            UpdatedAt = domainEntity.UpdatedAt,
        };
}
