using Trsr.Domain.Message;
using Trsr.Domain.TestResult;

namespace Trsr.Domain.Evaluator;

/// <summary>
/// Evaluates whether an actual assistant response matches an expected output.
/// </summary>
public interface IEvaluator : IDomainEntity
{
    /// <summary>The evaluation strategy used by this evaluator.</summary>
    EvaluatorKind Kind { get; }

    /// <summary>
    /// Returns true if <paramref name="actual"/> is considered a successful result
    /// for the given <paramref name="expected"/> output.
    /// </summary>
    Task<Evaluation> EvaluateAsync(AssistantMessage expected, AssistantMessage actual, CancellationToken cancellationToken = default);

    public delegate IEvaluator CreateNew();
    public delegate IEvaluator CreateExisting(IDomainEntityData existing);
}
