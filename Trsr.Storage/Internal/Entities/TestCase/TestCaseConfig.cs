using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Serialization;
using Trsr.Domain.Message;
using Trsr.Domain.TestCase;

namespace Trsr.Storage.Internal.Entities.TestCase;

internal class TestCaseConfig : AbstractEntityConfiguration<TestCaseEntity>, IMapper<ITestCase, TestCaseEntity>
{
    private readonly ITestCase.CreateExisting factory;
    private readonly ISerializer serializer;

    public TestCaseConfig(ITestCase.CreateExisting factory, ISerializer serializer)
    {
        this.factory = factory;
        this.serializer = serializer;
    }

    public override void Configure(EntityTypeBuilder<TestCaseEntity> builder)
    {
        builder
            .Property(e => e.Input)
            .HasConversion(
                v => serializer.Serialize(v),
                v => serializer.DeserializeRequired<Conversation>(v)
            );

        builder
            .Property(e => e.ExpectedOutput)
            .HasConversion(
                v => serializer.Serialize(v),
                v => serializer.DeserializeRequired<AssistantMessage>(v)
            );
    }

    public ITestCase Map(TestCaseEntity storedEntity)
        => factory(storedEntity);

    public TestCaseEntity Map(ITestCase domainEntity)
        => new()
        {
            Id = domainEntity.Id,
            Input = domainEntity.Input,
            ExpectedOutput = domainEntity.ExpectedOutput,
            CreatedAt = domainEntity.CreatedAt,
            UpdatedAt = domainEntity.UpdatedAt,
        };
}
