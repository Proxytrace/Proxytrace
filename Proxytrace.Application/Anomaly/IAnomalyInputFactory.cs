using Proxytrace.Domain.TestRunGroup;

namespace Proxytrace.Application.Anomaly;

/// <summary>
/// Assembles the pure <see cref="AnomalyInput"/> for a completed test-run group: one cohort per
/// endpoint with its current stats plus the rolling baseline computed from prior groups' stats.
/// Shared by the live detection pipeline and the kiosk demo seeder, so both feed the rule engine
/// identically shaped input.
/// </summary>
public interface IAnomalyInputFactory
{
    Task<AnomalyInput> BuildAsync(ITestRunGroup group, CancellationToken cancellationToken = default);
}
