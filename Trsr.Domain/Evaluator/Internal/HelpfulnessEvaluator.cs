using Trsr.Domain.Agent;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;

namespace Trsr.Domain.Evaluator.Internal;

internal record HelpfulnessEvaluator : PresetAgenticEvaluator, IHelpfulnessEvaluator
{
    protected override string PromptName
        => "helpfulness_evaluator";
    
    public override EvaluatorKind Kind 
        => EvaluatorKind.Helpfulness;

    public HelpfulnessEvaluator(IProject project, IPromptTemplateRepository promptTemplateRepository, IEvaluation.Create evaluationFactory, IAgentRepository agentRepository, IRepository<IEvaluator> repository) : base(project, promptTemplateRepository, evaluationFactory, agentRepository, repository)
    {
    }

    public HelpfulnessEvaluator(IProject project, IPromptTemplateRepository promptTemplateRepository, IEvaluation.Create evaluationFactory, IAgentRepository agentRepository, IDomainEntityData existing, IRepository<IEvaluator> repository) : base(project, promptTemplateRepository, evaluationFactory, agentRepository, existing, repository)
    {
    }
}
