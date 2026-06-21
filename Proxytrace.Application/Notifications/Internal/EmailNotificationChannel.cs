using System.Net;
using Microsoft.Extensions.Logging;
using Proxytrace.Domain;
using Proxytrace.Domain.Notification;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.User;

namespace Proxytrace.Application.Notifications.Internal;

/// <summary>
/// Emails a notification to its recipients. Recipients are a project's members (project-scoped
/// notifications) or all users (global), filtered to those who have email enabled and whose
/// per-user severity threshold the notification clears. Gated by the operator <see cref="EmailSettings"/>
/// (enabled + a floor severity). One message per recipient; a single failure is logged and skipped.
/// </summary>
internal sealed class EmailNotificationChannel : INotificationChannel
{
    private readonly IEmailSettingsStore settingsStore;
    private readonly IEmailSender sender;
    private readonly IProjectRepository projects;
    private readonly IRepository<IUser> users;
    private readonly ILogger<EmailNotificationChannel> logger;

    public EmailNotificationChannel(
        IEmailSettingsStore settingsStore,
        IEmailSender sender,
        IProjectRepository projects,
        IRepository<IUser> users,
        ILogger<EmailNotificationChannel> logger)
    {
        this.settingsStore = settingsStore;
        this.sender = sender;
        this.projects = projects;
        this.users = users;
        this.logger = logger;
    }

    public string Name => "Email";

    public async Task DeliverAsync(NotificationRequest request, CancellationToken cancellationToken = default)
    {
        EmailSettings? settings = await settingsStore.GetAsync(cancellationToken);
        if (settings is null || !settings.Enabled)
            return;

        if (request.Severity < settings.MinSeverity)
            return;

        IReadOnlyCollection<IUser> candidates;
        if (request.ProjectId is { } projectId)
        {
            var project = await projects.FindAsync(projectId, cancellationToken);
            if (project is null)
                return;
            candidates = project.Members;
        }
        else
        {
            candidates = await users.GetAllAsync(cancellationToken);
        }

        var recipients = candidates
            .Where(u => u.EmailNotificationsEnabled
                        && request.Severity >= u.EmailNotificationMinSeverity
                        && !string.IsNullOrWhiteSpace(u.Email))
            .ToList();
        if (recipients.Count == 0)
            return;

        var subject = $"[{request.Severity}] {request.Title}";
        var link = BuildLink(settings.AppBaseUrl, request.TargetKind, request.TargetId);
        var textBody = BuildText(request, link);
        var htmlBody = BuildHtml(request, link);

        foreach (var recipient in recipients)
        {
            try
            {
                await sender.SendAsync(
                    new EmailMessage(recipient.Email, recipient.Email, subject, htmlBody, textBody),
                    cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to email {Recipient} for '{Title}'", recipient.Email, request.Title);
            }
        }
    }

    private static string? BuildLink(string? appBaseUrl, NotificationTargetKind? kind, Guid? id)
    {
        if (string.IsNullOrWhiteSpace(appBaseUrl) || kind is not { } k || id is not { } i)
            return null;

        var route = k switch
        {
            NotificationTargetKind.TestRunGroup => $"/runs?id={i}",
            NotificationTargetKind.Agent => $"/agents?id={i}",
            NotificationTargetKind.OptimizationProposal => $"/proposals?id={i}",
            _ => null,
        };
        return route is null ? null : appBaseUrl.TrimEnd('/') + route;
    }

    private static string BuildText(NotificationRequest request, string? link)
    {
        var body = $"{request.Title}\n\n{request.Message}\n\nSeverity: {request.Severity}";
        return link is null ? body : $"{body}\n\nView details: {link}";
    }

    private static string BuildHtml(NotificationRequest request, string? link)
    {
        var title = WebUtility.HtmlEncode(request.Title);
        var message = WebUtility.HtmlEncode(request.Message);
        var severity = WebUtility.HtmlEncode(request.Severity.ToString());
        var button = link is null
            ? string.Empty
            : $"<p><a href=\"{link}\">View details</a></p>";
        return $"<h2>{title}</h2><p>{message}</p><p><strong>Severity:</strong> {severity}</p>{button}";
    }
}
