using Proxytrace.Domain.Agent;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.TestRunGroup;
using Proxytrace.Domain.TestSuite;

namespace Proxytrace.Application.TestRun;

public interface ITestRunnerService
{
    /// <summary>
    /// Executes a single-endpoint test run synchronously and returns the completed run.
    /// Used for direct invocations and tests.
    /// </summary>
    internal Task<ITestRunGroup> RunInForegroundAsync(
        ITestSuite suite,
        IReadOnlyList<IModelEndpoint> endpoints,
        IAgent? customAgent = null,
        bool isSystemTestRun = false,
        Func<ITestRunGroup, CancellationToken, Task>? onGroupCreated = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a group of runs — one per endpoint — executing the same suite for model comparison.
    /// Queues all runs for background execution and returns immediately with the pending group.
    /// </summary>
    Task<ITestRunGroup> RunInBackgroundAsync(
        ITestSuite suite,
        IReadOnlyList<IModelEndpoint> endpoints,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Cancels all in-flight runs in the group and transitions the group to Cancelled.
    /// </summary>
    Task<ITestRunGroup> CancelAsync(
        ITestRunGroup group,
        CancellationToken cancellationToken = default);
}
