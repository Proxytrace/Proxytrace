using Proxytrace.Domain.TestRunGroup;

namespace Proxytrace.Application.Anomaly;

/// <summary>
/// Queues completed test-run groups for anomaly detection. Mirrors <c>IOptimizerService</c>:
/// <see cref="EnqueueAsync"/> is called from the test runner on group completion, and a background
/// loop drains the queue.
/// </summary>
public interface IAnomalyDetectionService
{
    Task EnqueueAsync(ITestRunGroup testRunGroup, CancellationToken cancellationToken = default);
}
