using Trsr.Domain.Message;

namespace Trsr.Domain.Evaluator;

public interface IEvaluator : IDomainEntity
{
    EvaluatorKind Kind { get; }

    /// <summary>
    /// Returns true if <paramref name="actual"/> is considered a successful result
    /// for the given <paramref name="expected"/> output.
    /// </summary>
    bool Evaluate(AssistantMessage expected, AssistantMessage actual);

    public delegate IEvaluator CreateNew();
    public delegate IEvaluator CreateExisting(EvaluatorKind kind, IDomainEntityData existing);
}
