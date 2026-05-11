using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Agent;
using Trsr.Domain.Evaluator;
using Trsr.Domain.Internal;
using Trsr.Domain.Project;
using Trsr.Domain.TestCase;

namespace Trsr.Domain.TestSuite.Internal;

internal record TestSuite : DomainEntity<ITestSuite>, ITestSuite
{
    public string Name { get; }
    public IAgent Agent { get; }
    public IReadOnlyCollection<IEvaluator> Evaluators { get; }
    public IReadOnlyCollection<ITestCase> TestCases { get; }
    public IProject Project => Agent.Project;

    public TestSuite(
        string name,
        IAgent agent,
        IReadOnlyCollection<IEvaluator> evaluators,
        IReadOnlyCollection<ITestCase> testCases,
        IRepository<ITestSuite> repository) : base(repository)
    {
        Name = name;
        Agent = agent;
        Evaluators = evaluators.ToArray();
        TestCases = testCases.ToArray();
    }

    public TestSuite(
        string name,
        IAgent agent,
        IReadOnlyCollection<IEvaluator> evaluators,
        IReadOnlyCollection<ITestCase> testCases,
        IDomainEntityData existing,
        IRepository<ITestSuite> repository) : base(existing, repository)
    {
        Name = name;
        Agent = agent;
        Evaluators = evaluators.ToArray();
        TestCases = testCases.ToArray();
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
            yield return result;

        if (string.IsNullOrWhiteSpace(Name))
            foreach (var r in Validation.NotNullOrWhiteSpace(Name, nameof(Name)).AsEnumerable()) yield return r;

        foreach (var result in Agent.Validate(validationContext))
            yield return result;

        foreach (var result in Evaluators.SelectMany(e => e.Validate(validationContext)))
            yield return result;

        foreach (var result in TestCases.SelectMany(x => x.Validate(validationContext)))
            yield return result;
    }
}
