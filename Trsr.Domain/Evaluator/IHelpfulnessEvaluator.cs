using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Evaluator;

public interface IHelpfulnessEvaluator : IAgenticEvaluator
{
    public delegate IHelpfulnessEvaluator CreateNew(
        IModelEndpoint endpoint);
    
    public delegate IHelpfulnessEvaluator CreateExisting(
        IModelEndpoint endpoint,
        IDomainEntityData existing);
}