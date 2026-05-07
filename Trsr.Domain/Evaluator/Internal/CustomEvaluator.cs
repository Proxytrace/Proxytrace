using System.ComponentModel.DataAnnotations;
using JetBrains.Annotations;
using Trsr.Domain.Agent;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;

namespace Trsr.Domain.Evaluator.Internal;

[UsedImplicitly]
internal record CustomEvaluator : AbstractAgenticEvaluator, ICustomEvaluator
{
    public override EvaluatorKind Kind
        => EvaluatorKind.Custom;

    public string Name 
        => SystemPrompt.Name;
    
    public IPromptTemplate SystemPrompt { get; }

    public CustomEvaluator(
        IPromptTemplate systemPrompt,
        IProject project,
        IEvaluation.Create evaluationFactory,
        IAgentRepository agentRepository,
        IRepository<IEvaluator> repository) : base(project, evaluationFactory, agentRepository, repository)
    {
        SystemPrompt = systemPrompt;
    }

    public CustomEvaluator(
        IPromptTemplate systemPrompt,
        IProject project,
        IDomainEntityData existing,
        IEvaluation.Create evaluationFactory,
        IAgentRepository agentRepository,
        IRepository<IEvaluator> repository) : base(project, existing, evaluationFactory, agentRepository, repository)
    {
        SystemPrompt = systemPrompt;
    }

    protected override Task<IPromptTemplate> GetSystemPrompt(CancellationToken cancellationToken = default) 
        => Task.FromResult(SystemPrompt);

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (ValidationResult validationResult in SystemPrompt.Validate(validationContext))
        {
            yield return validationResult;
        }
    }
}
