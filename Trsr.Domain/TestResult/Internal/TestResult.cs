using System.ComponentModel.DataAnnotations;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.TestCase;

namespace Trsr.Domain.TestResult.Internal;

internal record TestResult : DomainEntity, ITestResult
{
    public ITestCase TestCase { get; }
    public AssistantMessage ActualResponse { get; }
    public Evaluation Evaluation { get; }
    public TimeSpan Duration { get; }

    public TestResult(
        ITestCase testCase, 
        AssistantMessage actualResponse,
        Evaluation evaluation,
        TimeSpan duration)
    {
        TestCase = testCase;
        ActualResponse = actualResponse;
        Evaluation = evaluation;
        Duration = duration;
    }

    public TestResult(
        ITestCase testCase,
        AssistantMessage actualResponse,
        Evaluation evaluation, 
        TimeSpan duration,
        IDomainEntityData existing) : base(existing)
    {
        TestCase = testCase;
        ActualResponse = actualResponse;
        Evaluation = evaluation;
        Duration = duration;
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        foreach (var result in TestCase.Validate(validationContext))
        {
            yield return result;
        }

        foreach (var result in ActualResponse.Validate(validationContext))
        {
            yield return result;
        }
    }
}
