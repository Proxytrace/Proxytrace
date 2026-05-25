using System.ComponentModel.DataAnnotations;
using System.Diagnostics;
using JetBrains.Annotations;
using Proxytrace.Common.Async;
using Proxytrace.Common.Validation;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.Completion;
using Proxytrace.Domain.Evaluation;
using Proxytrace.Domain.Internal;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.TestResult;
using Proxytrace.Domain.Usage;

namespace Proxytrace.Domain.Evaluator.Internal;

[UsedImplicitly]
internal sealed record AgenticEvaluator : DomainEntity<IEvaluator>, IAgenticEvaluator
{
    private readonly IEvaluation.Create evaluationFactory;
    private readonly IEvaluation.CreateErrored erroredFactory;

    public IAgent Agent { get; }

    public string Name => Agent.Name;

    public EvaluatorKind Kind
        => EvaluatorKind.Agentic;

    public IProject Project
        => Agent.Project;

    public AgenticEvaluator(
        IAgent agent,
        IEvaluation.Create evaluationFactory,
        IEvaluation.CreateErrored erroredFactory,
        IRepository<IEvaluator> repository) : base(repository)
    {
        Agent = agent;
        this.evaluationFactory = evaluationFactory;
        this.erroredFactory = erroredFactory;
    }

    public AgenticEvaluator(
        IAgent agent,
        IDomainEntityData existing,
        IEvaluation.Create evaluationFactory,
        IEvaluation.CreateErrored erroredFactory,
        IRepository<IEvaluator> repository) : base(existing, repository)
    {
        Agent = agent;
        this.evaluationFactory = evaluationFactory;
        this.erroredFactory = erroredFactory;
    }

    public async Task<IEvaluation?> EvaluateAsync(ITestResult testResult, CancellationToken cancellationToken = default)
    {
        Stopwatch sw = Stopwatch.StartNew();
        try
        {
            Conversation conversation = Conversation.Create();
            conversation.Add(BuildEvaluationMessage(testResult));

            var completion = await Agent
                .CreateClient()
                .CompleteAsync<AgenticEvaluatorResult>(
                    conversation,
                    cancellationToken: cancellationToken);

            if (completion.Response is null)
            {
                throw new InvalidOperationException("Agent response was null");
            }
            
            TokenUsage? usage = completion.Usage;
            decimal? cost = usage != null ? Agent.Endpoint.CalculateCost(usage) : null;

            return evaluationFactory(
                this, 
                completion.Response.Score, 
                completion.Latency, 
                usage, 
                cost, 
                completion.Response.Reasoning);
        }
        catch (Exception ex)
        {
            return erroredFactory(this, sw.Elapsed, ex);
        }
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

        yield return Validation.True(Agent.IsSystemAgent);
    }

    [UsedImplicitly]
    private record AgenticEvaluatorResult(
        EvaluationScore Score,
        string? Reasoning);
}
