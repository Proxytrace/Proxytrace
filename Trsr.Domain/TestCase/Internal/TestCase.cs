using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;

namespace Trsr.Domain.TestCase.Internal;

internal record TestCase : DomainEntity, ITestCase
{
    public Conversation Input { get; }
    public AssistantMessage ExpectedOutput { get; }
    public Guid? SourceAgentCallId { get; }

    public TestCase(Conversation input, AssistantMessage expectedOutput, Guid? sourceAgentCallId = null)
    {
        Input = input;
        ExpectedOutput = expectedOutput;
        SourceAgentCallId = sourceAgentCallId;
    }

    public TestCase(Conversation input, AssistantMessage expectedOutput, IDomainEntityData existing, Guid? sourceAgentCallId = null) : base(existing)
    {
        Input = input;
        ExpectedOutput = expectedOutput;
        SourceAgentCallId = sourceAgentCallId;
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        if (Input is null)
        {
            yield return Validation.NotNull(Input, nameof(Input));
        }

        if (ExpectedOutput is null)
        {
            yield return Validation.NotNull(ExpectedOutput, nameof(ExpectedOutput));
        }
    }
}
