using System.ComponentModel.DataAnnotations;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.TestResult;

namespace Trsr.Domain.Evaluator.Internal;

internal abstract record AbstractAgenticEvaluator : DomainEntity, IAgenticEvaluator
{
    public abstract EvaluatorKind Kind { get; }
    public abstract SystemMessage SystemMessage { get; }
    public abstract IModelEndpoint Endpoint { get; }
    
    protected AbstractAgenticEvaluator()
    {
    }

    protected AbstractAgenticEvaluator(IDomainEntityData existing) : base(existing)
    {
    }
    
    public Task<IEvaluation?> EvaluateAsync(ITestResult testResult, CancellationToken cancellationToken = default)
    {
        IModelClient client = Endpoint.CreateClient();

        var conversation = Conversation.Create();
        conversation.AddSystemMessage(SystemMessage);
        conversation.Add(BuildEvaluationMessage(testResult));

        client.CompleteAsync(
            conversation,
            cancellationToken: cancellationToken);

        throw new Exception();
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