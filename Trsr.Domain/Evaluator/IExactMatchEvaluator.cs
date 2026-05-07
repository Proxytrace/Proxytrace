using Trsr.Domain.Project;

namespace Trsr.Domain.Evaluator;

public interface IExactMatchEvaluator : IEvaluator
{
    public delegate IExactMatchEvaluator CreateNew(IProject project);
    public delegate IExactMatchEvaluator CreateExisting(
        IProject project,
        IDomainEntityData existing);
}