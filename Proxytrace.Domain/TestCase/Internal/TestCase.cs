using System.ComponentModel.DataAnnotations;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.Internal;
using Proxytrace.Domain.Message;

namespace Proxytrace.Domain.TestCase.Internal;

internal record TestCase : DomainEntity<ITestCase>, ITestCase
{
    public Conversation Input { get; }
    public AssistantMessage ExpectedOutput { get; }

    public TestCase(
        IAgentCall agentCall,
        IRepository<ITestCase> repository) : this(
        agentCall.Request,
        agentCall.Response?.Response
            ?? throw new InvalidOperationException("Agent call response cannot be null when creating a test case."),
        repository)
    {
    }

    public TestCase(
        Conversation input,
        AssistantMessage expectedOutput,
        IRepository<ITestCase> repository) : base(repository)
    {
        Input = input.WithoutSystemMessage();
        ExpectedOutput = expectedOutput;
    }

    public TestCase(
        Conversation input,
        AssistantMessage expectedOutput,
        IDomainEntityData existing,
        IRepository<ITestCase> repository) : base(existing, repository)
    {
        Input = input;
        ExpectedOutput = expectedOutput;
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        foreach (var result in Input.Validate(validationContext))
        {
            yield return result;
        }

        if (Input.Messages.Any(x => x.Role == Role.System))
        {
            yield return new ValidationResult("Input conversation cannot contain system messages.", [nameof(Input)]);
        }
        
        foreach (var result in ExpectedOutput.Validate(validationContext))
        {
            yield return result;
        }
        
    }
}