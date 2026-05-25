using Proxytrace.Domain.Agent;
using Proxytrace.Domain.Evaluator;
using Proxytrace.Domain.Search;
using Proxytrace.Domain.TestCase;

namespace Proxytrace.Domain.TestSuite;

/// <summary>
/// Represents a suite of test cases associated with an agent and an evaluator strategy.
/// </summary>
public interface ITestSuite : IDomainEntity<ITestSuite>, ISearchable
{
    /// <summary>Factory delegate for creating a new test suite.</summary>
    public delegate ITestSuite CreateNew(
        string name,
        IAgent agent,
        IReadOnlyCollection<IEvaluator> evaluators,
        IReadOnlyCollection<ITestCase> testCases);

    /// <summary>Factory delegate for reconstituting an existing test suite from persistence.</summary>
    public delegate ITestSuite CreateExisting(
        string name,
        IAgent agent,
        IReadOnlyCollection<IEvaluator> evaluators,
        IReadOnlyCollection<ITestCase> testCases,
        IDomainEntityData existing);

    /// <summary>A human-readable label for this test suite.</summary>
    public string Name { get; }

    /// <summary>The agent this test suite evaluates.</summary>
    public IAgent Agent { get; }

    /// <summary>The evaluator used to score each test case result.</summary>
    public IReadOnlyCollection<IEvaluator> Evaluators { get; }

    /// <summary>The test cases included in this suite.</summary>
    public IReadOnlyCollection<ITestCase> TestCases { get; }
    
    SearchKind ISearchable.SearchKind => SearchKind.TestSuite;
}
