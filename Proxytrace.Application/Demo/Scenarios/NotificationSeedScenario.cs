using Proxytrace.Domain;
using Proxytrace.Domain.Notification;
using Proxytrace.Domain.OptimizationProposal;

namespace Proxytrace.Application.Demo.Scenarios;

/// <summary>
/// Seeds a realistic spread of dashboard notifications (anomaly alerts + a ready proposal) so the
/// top-bar notifications inbox has content to demo and screenshot in kiosk mode. Runs after the
/// proposal scenario so a real proposal exists to deep-link to.
/// </summary>
internal sealed class NotificationSeedScenario : IDemoScenario
{
    private readonly DemoSeedContext ctx;
    private readonly INotification.CreateNew createNotification;
    private readonly INotificationRepository notifications;
    private readonly IRepository<IOptimizationProposal> proposals;

    public NotificationSeedScenario(
        DemoSeedContext ctx,
        INotification.CreateNew createNotification,
        INotificationRepository notifications,
        IRepository<IOptimizationProposal> proposals)
    {
        this.ctx = ctx;
        this.createNotification = createNotification;
        this.notifications = notifications;
        this.proposals = proposals;
    }

    // After OptimizationProposalSeedScenario (40) so a proposal is available to point at.
    public int Order => 50;

    private sealed record NotificationSpec(
        NotificationKind Kind,
        NotificationSeverity Severity,
        string Title,
        string Message,
        NotificationTargetKind? TargetKind,
        Guid? TargetId,
        bool Read);

    public async Task SeedAsync(CancellationToken cancellationToken)
    {
        var projectId = ctx.RequireProject().Id;

        var groups = ctx.AllRuns
            .Select(r => r.Group)
            .DistinctBy(g => g.Id)
            .ToList();
        var failedGroup = groups.ElementAtOrDefault(0);
        var regressedGroup = groups.ElementAtOrDefault(1) ?? failedGroup;

        var proposal = (await proposals.GetAllAsync(cancellationToken)).FirstOrDefault();

        // Listed oldest-first; the repository returns notifications newest-first, so the last spec
        // here lands at the top of the inbox. The two unread anomalies + ready proposal give a
        // badge count of 3 against one already-read alert.
        var specs = new List<NotificationSpec>
        {
            new(
                NotificationKind.Anomaly,
                NotificationSeverity.Warning,
                "Latency increase on the Code Review agent",
                "Average response latency rose to 2.4s — about 38 % above this suite's recent baseline.",
                ctx.CodeReviewAgent is { } codeReview ? NotificationTargetKind.Agent : null,
                ctx.CodeReviewAgent?.Id,
                Read: true),

            new(
                NotificationKind.ProposalReady,
                NotificationSeverity.Info,
                "Optimization proposal ready for review",
                "Switching the Customer Support agent to Claude is projected to raise pass rate by 17 points.",
                proposal is null ? null : NotificationTargetKind.OptimizationProposal,
                proposal?.Id,
                Read: false),

            new(
                NotificationKind.Anomaly,
                NotificationSeverity.Warning,
                "Pass-rate drop on the Tone suite",
                "Pass rate fell from 88 % to 64 % versus the recent baseline — a 24-point regression.",
                regressedGroup is null ? null : NotificationTargetKind.TestRunGroup,
                regressedGroup?.Id,
                Read: false),

            new(
                NotificationKind.Anomaly,
                NotificationSeverity.Critical,
                "Test run failed: endpoint unavailable",
                "The latest run of the Tone suite could not complete — the model endpoint returned no results.",
                failedGroup is null ? null : NotificationTargetKind.TestRunGroup,
                failedGroup?.Id,
                Read: false),
        };

        foreach (var spec in specs)
        {
            var notification = createNotification(
                spec.Kind,
                spec.Severity,
                spec.Title,
                spec.Message,
                projectId,
                spec.TargetKind,
                spec.TargetId);

            notification = await notifications.AddAsync(notification, cancellationToken);

            if (spec.Read)
            {
                await notification.MarkRead(cancellationToken);
            }
        }
    }
}
