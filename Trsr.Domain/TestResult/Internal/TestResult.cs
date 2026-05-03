using System.ComponentModel.DataAnnotations;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.TestCase;

namespace Trsr.Domain.TestResult.Internal;

internal record TestResult : DomainEntity<ITestResult>, ITestResult
{
    public ITestCase TestCase { get; }
    public AssistantMessage ActualResponse { get; }
    public IReadOnlyCollection<IEvaluation> Evaluations { get; }
    public TimeSpan Duration { get; }
    public EvaluationScore? OverallScore { get; }

    public TestResult(
        ITestCase testCase, 
        AssistantMessage actualResponse,
        IReadOnlyCollection<IEvaluation> evaluations,
        TimeSpan duration,
        IRepository<ITestResult> repository) : base(repository)
    {
        TestCase = testCase;
        ActualResponse = actualResponse;
        Evaluations = evaluations;
        Duration = duration;
        OverallScore = evaluations.CombineScores();
    }

    public TestResult(
        ITestCase testCase,
        AssistantMessage actualResponse,
        IReadOnlyCollection<IEvaluation> evaluations, 
        TimeSpan duration,
        IDomainEntityData existing,
        IRepository<ITestResult> repository) : base(existing, repository)
    {
        TestCase = testCase;
        ActualResponse = actualResponse;
        Evaluations = evaluations;
        Duration = duration;
        OverallScore = evaluations.CombineScores();
    }
    
    public async Task<ITestResult> AddEvaluationAsync(IEvaluation evaluation, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<IEvaluation> updatedEvaluations =
        [
            ..Evaluations.Where(x => x.Evaluator.Id != evaluation.Evaluator.Id),
            evaluation
        ];

        var updatedResults = new TestResult(
            TestCase,
            ActualResponse,
            updatedEvaluations,
            Duration,
            this,
            repository);
        return await repository.UpdateAsync(updatedResults, cancellationToken);
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
