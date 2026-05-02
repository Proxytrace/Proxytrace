using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Tools;

namespace Trsr.Domain.Evaluator;

/// <summary>
/// Checks whether the model uses the expected tool with fitting parameters
/// </summary>
public interface IToolUsageEvaluator : IAgenticEvaluator
{
    public delegate IToolUsageEvaluator CreateNew(
        IModelEndpoint endpoint);
    
    public delegate IToolUsageEvaluator CreateExisting(
        IModelEndpoint endpoint,
        IDomainEntityData existing);
}