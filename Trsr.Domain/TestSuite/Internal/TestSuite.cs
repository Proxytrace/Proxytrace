using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;

namespace Trsr.Domain.TestSuite.Internal;

internal record TestSuite : DomainEntity, ITestSuite
{
    public Guid Agent { get; }
    public IReadOnlyCollection<Guid> TestCases { get; }

    public TestSuite(Guid agent, IReadOnlyCollection<Guid> testCases)
    {
        Agent = agent;
        TestCases = testCases;
    }

    public TestSuite(ITestSuiteData existing) : base(existing)
    {
        Agent = existing.Agent;
        TestCases = existing.TestCases;
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        if (Agent == Guid.Empty)
        {
            yield return Validation.NotDefault(Agent, nameof(Agent));
        }
    }
}
