using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Agent;
using Trsr.Domain.Internal;
using Trsr.Domain.TestResult;

namespace Trsr.Domain.TestRun.Internal;

internal record TestRun : DomainEntity, ITestRun
{
    public DateTimeOffset Timestamp { get; }
    public IAgent Agent { get; }
    public IReadOnlyList<ITestResult> TestResults { get; }

    public TestRun(DateTimeOffset timestamp, IAgent agent, IReadOnlyList<ITestResult> testResults)
    {
        Timestamp = timestamp;
        Agent = agent;
        TestResults = testResults.ToArray();
    }

    public TestRun(DateTimeOffset timestamp, IAgent agent, IReadOnlyList<ITestResult> testResults, IDomainEntityData existing) : base(existing)
    {
        Timestamp = timestamp;
        Agent = agent;
        TestResults = testResults.ToArray();
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        if (Agent is null)
        {
            yield return Validation.NotNull(Agent, nameof(Agent));
        }
        else
        {
            foreach (var result in Agent.Validate(validationContext))
            {
                yield return result;
            }
        }

        if (TestResults is null)
        {
            yield return Validation.NotNull(TestResults, nameof(TestResults));
        }
        else
        {
            foreach (var result in TestResults.SelectMany(x => x.Validate(validationContext)))
            {
                yield return result;
            }
        }

        yield return Validation.InPast(Timestamp, nameof(Timestamp));
    }
}
