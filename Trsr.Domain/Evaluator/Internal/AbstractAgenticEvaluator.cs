using System.ComponentModel.DataAnnotations;
using JetBrains.Annotations;
using Trsr.Domain.Agent;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;
using Trsr.Domain.TestResult;

namespace Trsr.Domain.Evaluator.Internal;

internal abstract record AbstractAgenticEvaluator : DomainEntity<IEvaluator>, IAgenticEvaluator
{
    private readonly IEvaluation.Create evaluationFactory;
    private readonly IAgentRepository agentRepository;

    [UsedImplicitly]
    private record AgenticEvaluatorResult(EvaluationScore Score, string? Reasoning);

    public abstract EvaluatorKind Kind { get; }
    public IProject Project { get; }

    protected AbstractAgenticEvaluator(
        IProject project,
        IEvaluation.Create evaluationFactory,
        IAgentRepository agentRepository,
        IRepository<IEvaluator> repository) : base(repository)
    {
        Project = project;
        this.agentRepository = agentRepository;
        this.evaluationFactory = evaluationFactory;
    }

    protected AbstractAgenticEvaluator(
        IProject project,
        IDomainEntityData existing,
        IEvaluation.Create evaluationFactory,
        IAgentRepository agentRepository,
        IRepository<IEvaluator> repository) : base(existing, repository)
    {
        Project = project;
        this.evaluationFactory = evaluationFactory;
        this.agentRepository = agentRepository;
    }

    public async Task<IEvaluation?> EvaluateAsync(ITestResult testResult, CancellationToken cancellationToken = default)
    {
        IAgent agent = await GetEvaluationAgent(cancellationToken);

        AgenticEvaluatorResult? result = await agent
            .CreateClient()
            .CompleteAsync<AgenticEvaluatorResult>(
                BuildEvaluationMessage(testResult),
                cancellationToken: cancellationToken);

        return result is null
            ? null
            : evaluationFactory(this, result.Score, result.Reasoning);
    }

    private UserMessage BuildEvaluationMessage(ITestResult testResult)
    {
        string content = $"""
                          # INPUT
                          "{testResult.TestCase.Input}"

                          # EXPECTED OUTPUT
                          "{testResult.TestCase.ExpectedOutput}"

                          # ACTUAL OUTPUT
                          "{testResult.ActualResponse}"
                          """;

        return Message.Message.CreateUserMessage(content);
    }
    
    protected async Task<IAgent> GetEvaluationAgent(CancellationToken cancellationToken = default)
    {
        IPromptTemplate prompt = await GetSystemPrompt(cancellationToken);
        IAgent agent = await agentRepository.GetOrCreateAsync(
            prompt,
            tools: [],
            project: Project,
            endpoint: Project.SystemEndpoint,
            isSystemAgent: true,
            cancellationToken: cancellationToken);
        return agent;
    }

    protected abstract Task<IPromptTemplate> GetSystemPrompt(CancellationToken cancellationToken = default);

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var validationResult in base.Validate(validationContext))
        {
            yield return validationResult;
        }
    }
}