using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;

namespace Trsr.Domain.TestCase.Internal;

internal record TestCase : DomainEntity, ITestCase
{
    public Conversation Input { get; }
    public AssistantMessage ExpectedOutput { get; }

    public TestCase(Conversation input, AssistantMessage expectedOutput)
    {
        Input = input;
        ExpectedOutput = expectedOutput;
    }

    public TestCase(ITestCaseData existing) : base(existing)
    {
        Input = existing.Input;
        ExpectedOutput = existing.ExpectedOutput;
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
