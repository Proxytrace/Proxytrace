using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Common.Serialization;
using Trsr.Domain;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Message;
using Trsr.Domain.TestCase;
using Trsr.Domain.TestResult;
using Trsr.Domain.Usage;
using Trsr.Storage.Internal.Entities.TestCase;

namespace Trsr.Storage.Internal.Entities.TestResult;

internal class TestResultConfig : AbstractEntityConfiguration<TestResultEntity>, IMapper<ITestResult, TestResultEntity>
{
    private readonly IRepository<ITestCase> testCases;
    private readonly IRepository<IEvaluator> evaluators;
    private readonly ITestResult.CreateExisting factory;
    private readonly IEvaluation.Create createEvaluation;
    private readonly ISerializer serializer;

    public TestResultConfig(
        IRepository<ITestCase> testCases,
        IRepository<IEvaluator> evaluators,
        ITestResult.CreateExisting factory,
        IEvaluation.Create createEvaluation,
        ISerializer serializer)
    {
        this.testCases = testCases;
        this.evaluators = evaluators;
        this.factory = factory;
        this.createEvaluation = createEvaluation;
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

        builder
            .Property(e => e.Evaluations)
            .HasConversion(
                v => serializer.Serialize(v),
                v => serializer.Deserialize<IReadOnlyCollection<StoredEvaluation>>(v) ?? Array.Empty<StoredEvaluation>()
            );
    }

    public async Task<ITestResult> Map(TestResultEntity stored, CancellationToken cancellationToken = default)
    {
        var evaluations = new List<IEvaluation>();
        foreach (var e in stored.Evaluations)
        {
            var evaluator = await evaluators.GetAsync(e.EvaluatorId, cancellationToken);
            evaluations.Add(createEvaluation(evaluator, e.Score, e.Reasoning));
        }

        TokenUsage? usage = stored.InputTokens.HasValue && stored.OutputTokens.HasValue
            ? new TokenUsage((ulong)stored.InputTokens.Value, (ulong)stored.OutputTokens.Value)
            : null;

        return factory(
            testCase: await testCases.GetAsync(stored.TestCase, cancellationToken),
            actualResponse: stored.ActualResponse,
            evaluations: evaluations,
            latency: TimeSpan.FromMicroseconds(stored.DurationMs),
            usage: usage,
            existing: stored);
    }

    public Task<TestResultEntity> Map(ITestResult domain, CancellationToken cancellationToken = default)
        => new TestResultEntity
        {
            Id = domain.Id,
            TestCase = domain.TestCase.Id,
            ActualResponse = domain.ActualResponse,
            Evaluations = domain.Evaluations
                .Select(e => new StoredEvaluation { EvaluatorId = e.Evaluator.Id, Score = e.Score, Reasoning = e.Reasoning })
                .ToArray(),
            DurationMs = (long)domain.Latency.TotalMicroseconds,
            InputTokens = (long?)domain.Usage?.InputTokenCount,
            OutputTokens = (long?)domain.Usage?.OutputTokenCount,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}
