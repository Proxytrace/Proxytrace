using Trsr.Domain.Message;

namespace Trsr.Domain.Evaluator;

public interface IEvaluator : IDomainEntity, IEvaluatorData
{
    /// <summary>
    /// Returns true if <paramref name="actual"/> is considered a successful result
    /// for the given <paramref name="expected"/> output.
    /// </summary>
    bool Evaluate(AssistantMessage expected, AssistantMessage actual);

    public delegate IEvaluator CreateNew();
    public delegate IEvaluator CreateExisting(IEvaluatorData existing);
}
