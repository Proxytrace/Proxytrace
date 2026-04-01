using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Agent;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Internal;
using Trsr.Domain.TestCase;

namespace Trsr.Domain.TestSuite.Internal;

internal record TestSuite : DomainEntity, ITestSuite
{
    public IAgent Agent { get; }
    public IEvaluator Evaluator { get; }
    public IReadOnlyCollection<ITestCase> TestCases { get; }

    public TestSuite(IAgent agent, IEvaluator evaluator, IReadOnlyCollection<ITestCase> testCases)
    {
        Agent = agent;
        Evaluator = evaluator;
        TestCases = testCases.ToArray();
    }

    public TestSuite(
        IAgent agent,
        IEvaluator evaluator, 
        IReadOnlyCollection<ITestCase> testCases,
        IDomainEntityData existing) : base(existing)
    {
        Agent = agent;
        Evaluator = evaluator;
        TestCases = testCases.ToArray();
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

        if (Evaluator is null)
        {
            yield return Validation.NotNull(Evaluator, nameof(Evaluator));
        }
        else
        {
            foreach (var result in Evaluator.Validate(validationContext))
            {
                yield return result;
            }
        }

        if (TestCases is null)
        {
            yield return Validation.NotNull(TestCases, nameof(TestCases));
        }
        else
        {
            foreach (var result in TestCases.SelectMany(x => x.Validate(validationContext)))
            {
                yield return result;
            }
        }
    }
}
