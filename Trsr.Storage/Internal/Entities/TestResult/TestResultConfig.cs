using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Common.Serialization;
using Trsr.Domain;
using Trsr.Domain.Message;
using Trsr.Domain.TestCase;
using Trsr.Domain.TestResult;
using Trsr.Storage.Internal.Entities.TestCase;

namespace Trsr.Storage.Internal.Entities.TestResult;

internal class TestResultConfig : AbstractEntityConfiguration<TestResultEntity>, IMapper<ITestResult, TestResultEntity>
{
    private readonly IRepository<ITestCase> testCases;
    private readonly ITestResult.CreateExisting factory;
    private readonly ISerializer serializer;

    public TestResultConfig(
        IRepository<ITestCase> testCases,
        ITestResult.CreateExisting factory,
        ISerializer serializer)
    {
        this.testCases = testCases;
        this.factory = factory;
        this.serializer = serializer;
    }

    public override void Configure(EntityTypeBuilder<TestResultEntity> builder)
    {
        builder
            .HasOne<TestCaseEntity>()
            .WithMany()
            .HasForeignKey(e => e.TestCase)
            .OnDelete(DeleteBehavior.Restrict);

        builder
            .Property(e => e.ActualResponse)
            .HasConversion(
                v => serializer.Serialize(v),
                v => serializer.DeserializeRequired<AssistantMessage>(v)
            );
    }

    public async Task<ITestResult> Map(TestResultEntity stored, CancellationToken cancellationToken = default)
        => factory(
            testCase: await testCases.GetAsync(stored.TestCase, cancellationToken),
            actualResponse: stored.ActualResponse,
            evaluation: stored.Evaluation,
            duration: TimeSpan.FromMilliseconds(stored.DurationMs),
            existing: stored);

    public Task<TestResultEntity> Map(ITestResult domain, CancellationToken cancellationToken = default)
        => new TestResultEntity
        {
            Id = domain.Id,
            TestCase = domain.TestCase.Id,
            ActualResponse = domain.ActualResponse,
            Evaluation = domain.Evaluation,
            DurationMs = (long)domain.Duration.TotalMilliseconds,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}
