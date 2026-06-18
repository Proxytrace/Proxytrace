using Microsoft.Extensions.Logging;

namespace Proxytrace.Application.Notifications.Internal;

/// <summary>
/// Placeholder email channel. Email support is not implemented yet, so this no-ops (logs and
/// returns). It is registered now so the fan-out and DI are exercised end-to-end; when SMTP/email
/// support lands, the real delivery slots in here with no caller changes.
/// </summary>
internal sealed class EmailNotificationChannel : INotificationChannel
{
    private readonly ILogger<EmailNotificationChannel> logger;

    public EmailNotificationChannel(ILogger<EmailNotificationChannel> logger)
    {
        this.logger = logger;
    }

    public string Name => "Email";

    public Task DeliverAsync(NotificationRequest request, CancellationToken cancellationToken = default)
    {
        logger.LogDebug("Email channel not yet configured; skipping '{Title}'", request.Title);
        return Task.CompletedTask;
    }
}
