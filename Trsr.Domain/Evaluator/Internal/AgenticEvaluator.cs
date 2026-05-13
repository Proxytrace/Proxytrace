using System.ComponentModel.DataAnnotations;
using JetBrains.Annotations;
using Trsr.Common.Validation;
using Trsr.Domain.Agent;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Domain.TestResult;

namespace Trsr.Domain.Evaluator.Internal;

[UsedImplicitly]
internal sealed record AgenticEvaluator : DomainEntity<IEvaluator>, IAgenticEvaluator
{
    private readonly IEvaluation.Create evaluationFactory;
    
    public IAgent Agent { get; }

    public string Name => Agent.Name;

    public EvaluatorKind Kind 
        => EvaluatorKind.Agentic;

    public IProject Project
        => Agent.Project;

    public AgenticEvaluator(
        IAgent agent,
        IEvaluation.Create evaluationFactory,
        IRepository<IEvaluator> repository) : base(repository)
    {
        Agent = agent;
        this.evaluationFactory = evaluationFactory;
    }

    public AgenticEvaluator(
        IAgent agent,
        IDomainEntityData existing,
        IEvaluation.Create evaluationFactory,
        IRepository<IEvaluator> repository) : base(existing, repository)
    {
        Agent = agent;
        this.evaluationFactory = evaluationFactory;
    }

    public async Task<IEvaluation?> EvaluateAsync(ITestResult testResult, CancellationToken cancellationToken = default)
    {
        AgenticEvaluatorResult? result = await Agent
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

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var validationResult in base.Validate(validationContext))
        {
            yield return validationResult;
        }
        
        foreach (var validationResult in Agent.Validate(validationContext))
        {
            yield return validationResult;
        }

        foreach (var r in Validation.True(Agent.IsSystemAgent).AsEnumerable()) yield return r;
    }
    
    [UsedImplicitly]
    private record AgenticEvaluatorResult(
        EvaluationScore Score, 
        string? Reasoning);
}