namespace Proxytrace.Application.TestRun;

public sealed class TestRunnerConfiguration
{
    /// <summary>
    /// Maximum number of test cases that can execute in parallel within a single test run.
    /// Default is 2.
    /// </summary>
    public int MaxDegreeOfParallelism { get; init; } = 2;
}

