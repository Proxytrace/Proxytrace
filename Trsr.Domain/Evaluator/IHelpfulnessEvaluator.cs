using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Evaluator;

public interface IHelpfulnessEvaluator : IAgenticEvaluator
{
    public delegate ICustomEvaluator CreateNew(
        IModelEndpoint endpoint);
    
    public delegate ICustomEvaluator CreateExisting(
        IModelEndpoint endpoint,
        IDomainEntityData existing);
}