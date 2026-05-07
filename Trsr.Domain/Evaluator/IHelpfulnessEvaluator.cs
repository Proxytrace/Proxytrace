using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;

namespace Trsr.Domain.Evaluator;

public interface IHelpfulnessEvaluator : IAgenticEvaluator
{
    public delegate IHelpfulnessEvaluator CreateNew(IProject project);
    
    public delegate IHelpfulnessEvaluator CreateExisting(
        IProject project,
        IDomainEntityData existing);
}