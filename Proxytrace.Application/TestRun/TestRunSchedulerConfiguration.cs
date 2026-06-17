namespace Proxytrace.Application.TestRun;

/// <summary>Settings for the periodic test-run scheduler.</summary>
public sealed record TestRunSchedulerConfiguration
{
    /// <summary>How often the scheduler polls for due schedules.</summary>
    public TimeSpan TickInterval { get; init; } = TimeSpan.FromSeconds(60);
}
