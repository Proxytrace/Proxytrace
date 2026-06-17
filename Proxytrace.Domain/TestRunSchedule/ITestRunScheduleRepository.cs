namespace Proxytrace.Domain.TestRunSchedule;

public interface ITestRunScheduleRepository : IRepository<ITestRunSchedule>
{
    Task<IReadOnlyList<ITestRunSchedule>> GetByAgentAsync(Guid agentId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ITestRunSchedule>> GetByProjectAsync(Guid projectId, CancellationToken cancellationToken = default);

    /// <summary>Enabled schedules whose NextRunAt &lt;= now.</summary>
    Task<IReadOnlyList<ITestRunSchedule>> GetDueAsync(DateTimeOffset now, CancellationToken cancellationToken = default);
}
