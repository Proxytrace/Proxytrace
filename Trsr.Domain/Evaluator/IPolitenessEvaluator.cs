using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Domain.Tools;

namespace Trsr.Domain.Evaluator;

/// <summary>
/// Evaluates the response in terms of politness
/// </summary>
public interface IPolitenessEvaluator : IAgenticEvaluator
{
    public delegate IPolitenessEvaluator CreateNew(
        IProject project);
    
    public delegate IPolitenessEvaluator CreateExisting(
        IProject project,
        IDomainEntityData existing);
}