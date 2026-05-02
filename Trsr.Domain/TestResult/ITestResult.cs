using Trsr.Domain.Evaluation;
using Trsr.Domain.Message;
using Trsr.Domain.TestCase;

namespace Trsr.Domain.TestResult;

/// <summary>
/// Records the outcome of running a single <see cref="ITestCase"/>, including the actual response and evaluation verdict.
/// </summary>
public interface ITestResult : IDomainEntity
{
    /// <summary>The test case that was executed.</summary>
    ITestCase TestCase { get; }

    /// <summary>The actual assistant response produced during the test run.</summary>
    AssistantMessage ActualResponse { get; }

    /// <summary>The evaluation verdict comparing the actual response against the expected output.</summary>
    IReadOnlyCollection<IEvaluation> Evaluations { get; }

    /// <summary>How long the LLM call took for this test case, in milliseconds.</summary>
    TimeSpan Duration { get; }

    /// <summary>Factory delegate for creating a new test result.</summary>
    public delegate ITestResult CreateNew(
        ITestCase testCase,
        AssistantMessage actualResponse,
        IReadOnlyCollection<IEvaluation> evaluations, 
        TimeSpan duration);

    /// <summary>Factory delegate for reconstituting an existing test result from persistence.</summary>
    public delegate ITestResult CreateExisting(
        ITestCase testCase,
        AssistantMessage actualResponse,
        IReadOnlyCollection<IEvaluation> evaluations,
        TimeSpan duration,
        IDomainEntityData existing);

    /// <summary>
    /// Adds the evaluation to the test result
    /// </summary>
    Task<ITestResult> AddEvaluationAsync(
        IEvaluation evaluation,
        CancellationToken cancellationToken = default);
}
