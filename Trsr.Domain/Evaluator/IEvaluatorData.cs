namespace Trsr.Domain.Evaluator;

public interface IEvaluatorData : IDomainEntityData
{
    EvaluatorKind Kind { get; }
}
