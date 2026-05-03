using System.ComponentModel.DataAnnotations;
using JetBrains.Annotations;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.TestResult;

namespace Trsr.Domain.Evaluator.Internal;

internal abstract record AbstractAgenticEvaluator : DomainEntity<IEvaluator>, IAgenticEvaluator
{
    private readonly IEvaluation.Create evaluationFactory;

    [UsedImplicitly]
    private record AgenticEvaluatorResult(EvaluationScore Score, string? Reasoning);
    
    public abstract EvaluatorKind Kind { get; }
    public abstract SystemMessage SystemMessage { get; }
    public abstract IModelEndpoint Endpoint { get; }
    
    protected AbstractAgenticEvaluator(
        IEvaluation.Create evaluationFactory,
        IRepository<IEvaluator> repository) : base(repository)
    {
        this.evaluationFactory = evaluationFactory;
    }

    protected AbstractAgenticEvaluator(
        IEvaluation.Create evaluationFactory,
        IDomainEntityData existing,
        IRepository<IEvaluator> repository) : base(existing, repository)
    {
        this.evaluationFactory = evaluationFactory;
    }
    
    public async Task<IEvaluation?> EvaluateAsync(ITestResult testResult, CancellationToken cancellationToken = default)
    {
        IModelClient client = Endpoint.CreateClient();

        var conversation = Conversation.Create();
        conversation.AddSystemMessage(SystemMessage);
        conversation.Add(BuildEvaluationMessage(testResult));

        AgenticEvaluatorResult? result = await client.CompleteAsync<AgenticEvaluatorResult>(
            conversation,
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
        
        foreach (var validationResult in SystemMessage.Validate(validationContext))
        {
            yield return validationResult;
        }
        
        foreach (var validationResult in Endpoint.Validate(validationContext))
        {
            yield return validationResult;
        }
    }
}