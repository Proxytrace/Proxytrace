using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.TestSuite;

namespace Proxytrace.Domain.TestRunSchedule;

/// <summary>
/// A recurring schedule that runs a <see cref="ITestSuite"/> against a fixed set of endpoints
/// every <see cref="Interval"/>. Polled by the scheduler background service.
/// </summary>
public interface ITestRunSchedule : IDomainEntity<ITestRunSchedule>
{
    string Name { get; }
    ITestSuite Suite { get; }
    IReadOnlyCollection<IModelEndpoint> Endpoints { get; }
    TimeSpan Interval { get; }
    bool IsEnabled { get; }
    DateTimeOffset NextRunAt { get; }
    DateTimeOffset? LastRunAt { get; }

    public delegate ITestRunSchedule CreateNew(
        string name, ITestSuite suite, IReadOnlyCollection<IModelEndpoint> endpoints,
        TimeSpan interval, bool isEnabled);

    public delegate ITestRunSchedule CreateExisting(
        string name, ITestSuite suite, IReadOnlyCollection<IModelEndpoint> endpoints,
        TimeSpan interval, bool isEnabled, DateTimeOffset nextRunAt, DateTimeOffset? lastRunAt,
        IDomainEntityData existing);

    Task<ITestRunSchedule> Disable(CancellationToken cancellationToken = default);
    Task<ITestRunSchedule> Enable(CancellationToken cancellationToken = default);

    /// <summary>
    /// Records a fire at <paramref name="now"/>: sets LastRunAt and advances NextRunAt forward by
    /// whole intervals until it is strictly after <paramref name="now"/> (missed ticks collapse —
    /// no catch-up burst).
    /// </summary>
    Task<ITestRunSchedule> RecordFired(DateTimeOffset now, CancellationToken cancellationToken = default);

    Task<ITestRunSchedule> Update(
        string name, IReadOnlyCollection<IModelEndpoint> endpoints,
        TimeSpan interval, bool isEnabled, CancellationToken cancellationToken = default);
}
