using System.ComponentModel.DataAnnotations;
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
        
        foreach (var result in Agent.Validate(validationContext))
        {
            yield return result;
        }
        
        foreach (var result in Evaluator.Validate(validationContext))
        {
            yield return result;
        }
        
        foreach (var result in TestCases.SelectMany(x => x.Validate(validationContext)))
        {
            yield return result;
        }
    }
}
