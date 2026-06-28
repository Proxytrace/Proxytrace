using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Proxytrace.Domain;
using Proxytrace.Domain.Demo;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;

namespace Proxytrace.Application.TestRun.Internal;

/// <summary>
/// On startup, marks any test-run group (and its runs) left in a non-terminal state by a previous
/// shutdown as <see cref="TestRunStatus.Cancelled"/>. The runner's work queue and in-flight state live
/// only in memory, so a process restart mid-run strands those groups in <c>Running</c>/<c>Pending</c>
/// forever — they can't be resumed. Reaping them on boot keeps the UI honest (a re-opened stream of a
/// now-cancelled group immediately reports completion) and lets the suite/schedule aggregates settle.
/// Idempotent — a clean shutdown leaves nothing to reap.
/// </summary>
internal sealed class OrphanedTestRunReaperHostedService : IHostedService
{
    private readonly IServiceProvider rootServices;
    private readonly ILogger<OrphanedTestRunReaperHostedService> logger;

    public OrphanedTestRunReaperHostedService(
        IServiceProvider rootServices,
        ILogger<OrphanedTestRunReaperHostedService> logger)
    {
        this.rootServices = rootServices;
        this.logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = rootServices.CreateScope();
        var services = scope.ServiceProvider;

        await services.GetRequiredService<IDatabaseInitializer>().EnsureDatabaseReadyAsync(cancellationToken);

        await ReapAsync(
            services.GetRequiredService<ITestRunGroupRepository>(),
            services.GetRequiredService<ITestRunRepository>(),
            logger,
            cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    /// <summary>
    /// Cancels every non-terminal group and its non-terminal runs. Each group is handled
    /// independently so one bad row can't abort the sweep. Exposed for testing.
    /// </summary>
    internal static async Task ReapAsync(
        ITestRunGroupRepository groups,
        ITestRunRepository runs,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        var orphaned = await groups.GetByStatusesAsync(
            [TestRunStatus.Pending, TestRunStatus.Running],
            cancellationToken);

        if (orphaned.Count == 0)
            return;

        logger.LogWarning(
            "Reaping {Count} test-run group(s) left non-terminal by a previous shutdown — marking them cancelled",
            orphaned.Count);

        foreach (var group in orphaned)
        {
            try
            {
                var groupRuns = await runs.GetByGroupAsync(group.Id, cancellationToken);
                foreach (var run in groupRuns.Where(r => !IsTerminal(r.Status)))
                    await run.SetCancelled(cancellationToken);

                var reloaded = await groups.GetAsync(group.Id, cancellationToken);
                if (!IsTerminal(reloaded.Status))
                    await reloaded.SetCancelled(cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to reap orphaned test-run group {GroupId}", group.Id);
            }
        }
    }

    private static bool IsTerminal(TestRunStatus status)
        => status is TestRunStatus.Completed or TestRunStatus.Failed or TestRunStatus.Cancelled;
}
