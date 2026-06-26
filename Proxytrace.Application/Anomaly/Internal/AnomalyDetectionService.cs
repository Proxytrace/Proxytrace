using System.Threading.Channels;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Proxytrace.Application.Notifications;
using Proxytrace.Application.Statistics;
using Proxytrace.Application.Statistics.TestRun;
using Proxytrace.Application.TestRun;
using Proxytrace.Domain.Notification;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;

namespace Proxytrace.Application.Anomaly.Internal;

/// <summary>
/// Background pipeline that inspects completed test-run groups for negative anomalies and raises
/// notifications. Structurally mirrors <c>OptimizerService</c>: a queue fed from the test runner on
/// group completion, drained by a single worker loop.
/// </summary>
internal sealed class AnomalyDetectionService : BackgroundService, IAnomalyDetectionService
{
    private readonly IAnomalyDetector detector;
    private readonly ITestRunGroupRepository testRunGroups;
    private readonly ITestRunRepository testRuns;
    private readonly IStatsReader<TestRunStats, TestRunStats.Filter> runStats;
    private readonly INotificationService notifications;
    private readonly AnomalyDetectionConfiguration configuration;
    private readonly ILogger<AnomalyDetectionService> logger;

    private readonly Channel<Guid> channel = Channel.CreateUnbounded<Guid>(
        new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false,
        });

    public AnomalyDetectionService(
        IAnomalyDetector detector,
        ITestRunGroupRepository testRunGroups,
        ITestRunRepository testRuns,
        IStatsReader<TestRunStats, TestRunStats.Filter> runStats,
        INotificationService notifications,
        AnomalyDetectionConfiguration configuration,
        ILogger<AnomalyDetectionService> logger)
    {
        this.detector = detector;
        this.testRunGroups = testRunGroups;
        this.testRuns = testRuns;
        this.runStats = runStats;
        this.notifications = notifications;
        this.configuration = configuration;
        this.logger = logger;
    }

    public Task EnqueueAsync(ITestRunGroup testRunGroup, CancellationToken cancellationToken = default)
        => channel.Writer.WriteAsync(testRunGroup.Id, cancellationToken).AsTask();

    protected override async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        try
        {
            await foreach (var groupId in channel.Reader.ReadAllAsync(cancellationToken))
            {
                try
                {
                    await DetectAsync(groupId, cancellationToken);
                }
                catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
                {
                    // individual job cancelled — continue processing
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Anomaly detection failed for test run group {GroupId}", groupId);
                }
            }
        }
        catch (OperationCanceledException)
        {
            // graceful shutdown
        }
    }

    private async Task DetectAsync(Guid groupId, CancellationToken cancellationToken)
    {
        var group = await testRunGroups.FindAsync(groupId, cancellationToken);
        if (group is null)
        {
            logger.LogWarning("Test run group {GroupId} not found — skipping anomaly detection", groupId);
            return;
        }

        var input = await BuildInputAsync(group, cancellationToken);
        var anomalies = detector.Detect(input);
        if (anomalies.Count == 0)
            return;

        logger.LogInformation(
            "Anomaly detection flagged {Count} issue(s) for test run group {GroupId}",
            anomalies.Count, groupId);

        foreach (var anomaly in anomalies)
        {
            await notifications.NotifyAsync(
                new NotificationRequest(
                    NotificationKind.Anomaly,
                    anomaly.Severity,
                    anomaly.Title,
                    anomaly.Message,
                    input.ProjectId,
                    anomaly.TargetKind,
                    anomaly.TargetId),
                cancellationToken);
        }
    }

    private async Task<AnomalyInput> BuildInputAsync(ITestRunGroup group, CancellationToken cancellationToken)
    {
        var runs = await testRuns.GetByGroupAsync(group.Id, cancellationToken);
        var testCaseCount = group.Suite.TestCases.Count;

        // Collapse the group's runs to one cohort per endpoint, so a sampled group raises at most one
        // anomaly per endpoint (off the cohort mean) rather than N near-identical ones.
        var groupStats = await runStats.QueryAsync(
            new TestRunStats.Filter(GroupId: group.Id), cancellationToken);
        var cohorts = RunCohort.Build(runs, groupStats.ToDictionary(s => s.TestRunId));
        var runInputs = new List<AnomalyRunInput>(cohorts.Count);

        foreach (var cohort in cohorts)
        {
            var representative = cohort.Representative;
            var current = cohort.Stats;
            var baseline = await BuildBaselineAsync(group, cohort.EndpointId, cancellationToken);

            runInputs.Add(new AnomalyRunInput(
                EndpointId: cohort.EndpointId,
                EndpointName: representative.Endpoint.Model.Name,
                RunFailed: representative.Status == TestRunStatus.Failed,
                TestCaseCount: testCaseCount,
                ResultCount: representative.TestResults.Count,
                CurrentPassRate: current?.PassRate,
                CurrentAverageLatency: AverageLatency(current),
                BaselinePassRate: baseline.PassRate,
                BaselineAverageLatency: baseline.AverageLatency,
                BaselineSampleCount: baseline.SampleCount));
        }

        return new AnomalyInput(
            GroupId: group.Id,
            ProjectId: group.Suite.Project.Id,
            SuiteName: group.Suite.Name,
            GroupFailed: group.Status == TestRunStatus.Failed,
            Runs: runInputs);
    }

    private async Task<(double? PassRate, TimeSpan? AverageLatency, int SampleCount)> BuildBaselineAsync(
        ITestRunGroup group,
        Guid endpointId,
        CancellationToken cancellationToken)
    {
        var history = await runStats.QueryAsync(
            new TestRunStats.Filter(
                SuiteId: group.Suite.Id,
                EndpointId: endpointId),
            cancellationToken);

        // Average each prior group's samples to a single baseline point first, so one sampled group
        // counts once in the rolling window instead of crowding it out with N rows.
        var priorGroups = history
            .Where(s => s.GroupId != group.Id)
            .GroupBy(s => s.GroupId)
            .Select(g =>
            {
                var rates = g.Select(s => s.PassRate).OfType<double>().ToList();
                var lats = g.Select(AverageLatency).OfType<TimeSpan>().ToList();
                return (
                    CompletedAt: g.Max(s => s.RunCompletedAt),
                    PassRate: rates.Count > 0 ? (double?)rates.Average() : null,
                    AverageLatency: lats.Count > 0
                        ? (TimeSpan?)TimeSpan.FromTicks((long)lats.Average(l => l.Ticks))
                        : null);
            })
            .OrderByDescending(x => x.CompletedAt)
            .Take(configuration.BaselineWindow)
            .ToList();

        if (priorGroups.Count == 0)
            return (null, null, 0);

        var passRates = priorGroups
            .Select(x => x.PassRate)
            .OfType<double>()
            .ToList();
        var latencies = priorGroups
            .Select(x => x.AverageLatency)
            .OfType<TimeSpan>()
            .ToList();

        double? passRate = passRates.Count > 0 ? passRates.Average() : null;
        TimeSpan? avgLatency = latencies.Count > 0
            ? TimeSpan.FromTicks((long)latencies.Average(l => l.Ticks))
            : null;

        return (passRate, avgLatency, priorGroups.Count);
    }

    private static TimeSpan? AverageLatency(TestRunStats? stats)
        => stats is { TestCases: > 0, TotalDuration: { } total }
            ? total / stats.TestCases
            : null;
}
