using Trsr.Domain.Agent;
using Trsr.Domain.Evaluator;
using Trsr.Domain.TestCase;

namespace Trsr.Domain.TestSuite;

/// <summary>
/// Represents a suite of test cases associated with an agent and an evaluator strategy.
/// </summary>
public interface ITestSuite : IDomainEntity
{
    /// <summary>Factory delegate for creating a new test suite.</summary>
    public delegate ITestSuite CreateNew(
        IAgent agent,
        IEvaluator evaluator,
        IReadOnlyCollection<ITestCase> testCases);

    /// <summary>Factory delegate for reconstituting an existing test suite from persistence.</summary>
    public delegate ITestSuite CreateExisting(
        IAgent agent,
        IEvaluator evaluator,
        IReadOnlyCollection<ITestCase> testCases,
        IDomainEntityData existing);

    /// <summary>The agent this test suite evaluates.</summary>
    public IAgent Agent { get; }

    /// <summary>The evaluator used to score each test case result.</summary>
    public IEvaluator Evaluator { get; }

    /// <summary>The test cases included in this suite.</summary>
    public IReadOnlyCollection<ITestCase> TestCases { get; }
}
