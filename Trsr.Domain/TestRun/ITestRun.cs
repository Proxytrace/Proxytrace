using Trsr.Domain.Agent;
using Trsr.Domain.TestResult;

namespace Trsr.Domain.TestRun;

public interface ITestRun : IDomainEntity
{
    DateTimeOffset Timestamp { get; }
    IAgent Agent { get; }
    IReadOnlyList<ITestResult> TestResults { get; }

    public delegate ITestRun CreateNew(DateTimeOffset timestamp, IAgent agent, IReadOnlyList<ITestResult> testResults);
    public delegate ITestRun CreateExisting(DateTimeOffset timestamp, IAgent agent, IReadOnlyList<ITestResult> testResults, IDomainEntityData existing);
}
