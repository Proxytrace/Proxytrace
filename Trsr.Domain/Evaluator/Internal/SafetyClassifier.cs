using JetBrains.Annotations;
using Trsr.Domain.Agent;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;

namespace Trsr.Domain.Evaluator.Internal;

[UsedImplicitly]
internal record SafetyClassifier : PresetAgenticEvaluator, ISafetyClassifier
{
    protected override string PromptName 
        => "safety_evaluator";
    
    public override EvaluatorKind Kind
        =>  EvaluatorKind.Safety;
    
    public SafetyClassifier(IProject project, IPromptTemplateRepository promptTemplateRepository, IEvaluation.Create evaluationFactory, IAgentRepository agentRepository, IRepository<IEvaluator> repository) : base(project, promptTemplateRepository, evaluationFactory, agentRepository, repository)
    {
    }

    public SafetyClassifier(IProject project, IPromptTemplateRepository promptTemplateRepository, IEvaluation.Create evaluationFactory, IAgentRepository agentRepository, IDomainEntityData existing, IRepository<IEvaluator> repository) : base(project, promptTemplateRepository, evaluationFactory, agentRepository, existing, repository)
    {
    }
}
