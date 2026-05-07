using Trsr.Domain.Agent;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;

namespace Trsr.Domain.Evaluator.Internal;

internal abstract record PresetAgenticEvaluator : AbstractAgenticEvaluator
{
    private readonly IPromptTemplateRepository promptTemplateRepository;

    protected abstract string PromptName { get; }
    
    protected PresetAgenticEvaluator(
        IProject project,
        IPromptTemplateRepository promptTemplateRepository,
        IEvaluation.Create evaluationFactory,
        IAgentRepository agentRepository,
        IRepository<IEvaluator> repository) : base(project, evaluationFactory, agentRepository, repository)
    {
        this.promptTemplateRepository = promptTemplateRepository;
    }
    
    protected PresetAgenticEvaluator(
        IProject project,
        IPromptTemplateRepository promptTemplateRepository,
        IEvaluation.Create evaluationFactory,
        IAgentRepository agentRepository,
        IDomainEntityData existing,
        IRepository<IEvaluator> repository) : base(project, existing, evaluationFactory, agentRepository, repository)
    {
        this.promptTemplateRepository = promptTemplateRepository;
    }

    protected override Task<IPromptTemplate> GetSystemPrompt(CancellationToken cancellationToken = default) 
        => promptTemplateRepository.GetAsync(PromptName, cancellationToken);
}