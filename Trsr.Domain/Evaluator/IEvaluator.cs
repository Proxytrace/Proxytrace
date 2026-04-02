using Trsr.Domain.Message;

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
    bool Evaluate(AssistantMessage expected, AssistantMessage actual);

    public delegate IEvaluator CreateNew();
    public delegate IEvaluator CreateExisting(EvaluatorKind kind, IDomainEntityData existing);
}
