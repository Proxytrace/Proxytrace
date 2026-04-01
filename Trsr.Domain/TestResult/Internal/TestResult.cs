using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.TestCase;

namespace Trsr.Domain.TestResult.Internal;

internal record TestResult : DomainEntity, ITestResult
{
    public ITestCase TestCase { get; }
    public AssistantMessage ActualResponse { get; }
    public Evaluation Evaluation { get; }

    public TestResult(ITestCase testCase, AssistantMessage actualResponse, Evaluation evaluation)
    {
        TestCase = testCase;
        ActualResponse = actualResponse;
        Evaluation = evaluation;
    }

    public TestResult(ITestCase testCase, AssistantMessage actualResponse, Evaluation evaluation, IDomainEntityData existing) : base(existing)
    {
        TestCase = testCase;
        ActualResponse = actualResponse;
        Evaluation = evaluation;
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        if (TestCase is null)
        {
            yield return Validation.NotNull(TestCase, nameof(TestCase));
        }
        else
        {
            foreach (var result in TestCase.Validate(validationContext))
            {
                yield return result;
            }
        }

        if (ActualResponse is null)
        {
            yield return Validation.NotNull(ActualResponse, nameof(ActualResponse));
        }
        else
        {
            foreach (var result in ActualResponse.Validate(validationContext))
            {
                yield return result;
            }
        }
    }
}
