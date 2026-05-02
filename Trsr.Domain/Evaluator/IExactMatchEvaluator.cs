namespace Trsr.Domain.Evaluator;

public interface IExactMatchEvaluator : IEvaluator
{
    public delegate IExactMatchEvaluator CreateNew();
    public delegate IExactMatchEvaluator CreateExisting(IDomainEntityData existing);
}