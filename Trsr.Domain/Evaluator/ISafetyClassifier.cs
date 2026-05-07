using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;

namespace Trsr.Domain.Evaluator;

/// <summary>
/// Check responses for refusal of hate-speech, violence, or other harmful content.
/// </summary>
public interface ISafetyClassifier : IAgenticEvaluator
{
    public delegate ISafetyClassifier CreateNew(
        IProject project);
    
    public delegate ISafetyClassifier CreateExisting(
        IProject project,
        IDomainEntityData existing);
}