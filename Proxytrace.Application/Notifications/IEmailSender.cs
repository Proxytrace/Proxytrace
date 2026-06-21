namespace Proxytrace.Application.Notifications;

/// <summary>A single outgoing email.</summary>
public sealed record EmailMessage(string To, string? ToName, string Subject, string HtmlBody, string TextBody);

/// <summary>
/// Sends a single email over the operator-configured SMTP server. The MailKit implementation reads
/// <see cref="EmailSettings"/> per call, so configuration changes take effect without a restart.
/// </summary>
public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
}
