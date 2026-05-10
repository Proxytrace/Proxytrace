using System.ComponentModel.DataAnnotations;
using Trsr.Domain.Completion;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.TestCase;

namespace Trsr.Domain.TestResult.Internal;

internal record TestResult : DomainEntity<ITestResult>, ITestResult
{
    public ITestCase TestCase { get; init; }
    public AssistantMessage ActualResponse { get; init; }
    public bool Passed => Evaluations.All(x => x.Passed);
    public IReadOnlyCollection<IEvaluation> Evaluations { get; init; }
    public TestResultStatistics Statistics { get; init; }
    public EvaluationScore? OverallScore => Evaluations.CombineScores();

    public TestResult(
        ITestCase testCase,
        ICompletion completion,
        IReadOnlyCollection<IEvaluation> evaluations,
        IRepository<ITestResult> repository) : base(repository)
    {
        TestCase = testCase;
        ActualResponse = completion.Response;
        Evaluations = evaluations;
        Statistics = TestResultStatistics.FromCompletion(completion);
    }

    public TestResult(
        ITestCase testCase,
        AssistantMessage actualResponse,
        IReadOnlyCollection<IEvaluation> evaluations,
        IDomainEntityData existing,
        TestResultStatistics statistics,
        IRepository<ITestResult> repository) : base(existing, repository)
    {
        TestCase = testCase;
        ActualResponse = actualResponse;
        Evaluations = evaluations;
        Statistics = statistics;
    }

    public Task<ITestResult> AddEvaluationAsync(IEvaluation evaluation, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<IEvaluation> updatedEvaluations =
        [
            ..Evaluations.Where(x => x.Evaluator.Id != evaluation.Evaluator.Id),
            evaluation
        ];

        return ApplyAsync(this with { Evaluations = updatedEvaluations }, cancellationToken);
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        foreach (var result in TestCase.Validate(validationContext))
        {
            yield return result;
        }

        foreach (var result in ActualResponse.Validate(validationContext))
        {
            yield return result;
        }

        foreach (IEvaluation evaluation in Evaluations)
        {
            foreach (var result in evaluation.Validate(validationContext))
            {
                yield return result;
            }
        }
    }
}
