using JetBrains.Annotations;
using Trsr.Domain.Agent;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;

namespace Trsr.Domain.Evaluator.Internal;

[UsedImplicitly]
internal record ToolUsageEvaluator : PresetAgenticEvaluator, IToolUsageEvaluator
{
    protected override string PromptName 
        => "tool_usage_evaluator";
    
    public override EvaluatorKind Kind
        =>  EvaluatorKind.ToolUsage;
    
    public ToolUsageEvaluator(IProject project, IPromptTemplateRepository promptTemplateRepository, IEvaluation.Create evaluationFactory, IAgentRepository agentRepository, IRepository<IEvaluator> repository) : base(project, promptTemplateRepository, evaluationFactory, agentRepository, repository)
    {
    }

    public ToolUsageEvaluator(IProject project, IPromptTemplateRepository promptTemplateRepository, IEvaluation.Create evaluationFactory, IAgentRepository agentRepository, IDomainEntityData existing, IRepository<IEvaluator> repository) : base(project, promptTemplateRepository, evaluationFactory, agentRepository, existing, repository)
    {
    }
}
