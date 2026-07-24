namespace Proxytrace.Domain.TestSupport;

/// <summary>
/// Test-only hook that clears all per-run domain content (agents, traces, evaluators, suites,
/// runs, proposals, invites, notifications) while preserving the setup baseline (users, providers,
/// models, endpoints, api keys, projects). Lets the e2e suite reset to a known state between tests
/// so specs that assert exact counts / empty states are not affected by earlier specs' data.
/// </summary>
public interface ITestDataReset
{
    /// <summary>
    /// Truncates the domain content tables, leaving the setup baseline intact.
    /// </summary>
    Task ResetAsync(CancellationToken cancellationToken = default);
}
