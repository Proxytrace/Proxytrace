using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Evaluator;

/// <summary>
/// Check responses for refusal of hate-speech, violence, or other harmful content.
/// </summary>
public interface ISafetyClassifier : IAgenticEvaluator
{
    public delegate ISafetyClassifier CreateNew(
        IModelEndpoint endpoint);
    
    public delegate ISafetyClassifier CreateExisting(
        IModelEndpoint endpoint,
        IDomainEntityData existing);
}