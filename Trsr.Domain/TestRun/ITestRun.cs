using Trsr.Domain.Agent;
using Trsr.Domain.TestResult;

namespace Trsr.Domain.TestRun;

/// <summary>
/// Represents an execution of a test suite against an agent, capturing all individual test results.
/// </summary>
public interface ITestRun : IDomainEntity
{
    /// <summary>The time at which this test run was initiated.</summary>
    DateTimeOffset Timestamp { get; }

    /// <summary>The agent evaluated by this test run.</summary>
    IAgent Agent { get; }

    /// <summary>The ordered list of results for each test case executed during this run.</summary>
    IReadOnlyList<ITestResult> TestResults { get; }

    /// <summary>Factory delegate for creating a new test run.</summary>
    public delegate ITestRun CreateNew(DateTimeOffset timestamp, IAgent agent, IReadOnlyList<ITestResult> testResults);

    /// <summary>Factory delegate for reconstituting an existing test run from persistence.</summary>
    public delegate ITestRun CreateExisting(DateTimeOffset timestamp, IAgent agent, IReadOnlyList<ITestResult> testResults, IDomainEntityData existing);
}
