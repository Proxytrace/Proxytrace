using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestSuite;

namespace Trsr.Application.TestRun;

public interface ITestRunnerService
{
    /// <summary>
    /// Executes a test suite synchronously and returns the completed run.
    /// Used for direct invocations and tests.
    /// </summary>
    internal Task<ITestRun> RunInForegroundAsync(
        ITestSuite suite,
        IModelEndpoint endpoint,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a pending run, queues background execution, and returns immediately.
    /// </summary>
    Task<ITestRun> RunInBackgroundAsync(
        ITestSuite suite,
        IModelEndpoint endpoint,
        CancellationToken cancellationToken = default);

}
