using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Domain.Tools;

namespace Trsr.Domain.Evaluator;

/// <summary>
/// Checks whether the model uses the expected tool with fitting parameters
/// </summary>
public interface IToolUsageEvaluator : IAgenticEvaluator
{
    public delegate IToolUsageEvaluator CreateNew(
        IProject project);
    
    public delegate IToolUsageEvaluator CreateExisting(
        IProject project,
        IDomainEntityData existing);
}