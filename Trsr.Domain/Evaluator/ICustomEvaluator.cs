using Trsr.Domain.Project;
using Trsr.Domain.Prompt;

namespace Trsr.Domain.Evaluator;

public interface ICustomEvaluator : IAgenticEvaluator
{
    string Name { get; }
    IPromptTemplate SystemPrompt { get; }

    public delegate ICustomEvaluator CreateNew(
        IPromptTemplate systemPrompt,
        IProject project);

    public delegate ICustomEvaluator CreateExisting(
        IPromptTemplate systemPrompt,
        IProject project,
        IDomainEntityData existing);
}