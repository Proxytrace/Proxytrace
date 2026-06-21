using Proxytrace.Domain.Notification;

namespace Proxytrace.Application.Notifications;

/// <summary>How the SMTP connection is secured (maps to MailKit's <c>SecureSocketOptions</c>).</summary>
public enum SmtpSecurity
{
    None,
    StartTls,
    Auto,
    SslOnConnect,
}

/// <summary>
/// Operator-configured outgoing-email settings. A single instance per installation. <see cref="Password"/>
/// is the plaintext SMTP password in memory; it is encrypted at rest by the store via
/// <see cref="Proxytrace.Application.Security.ISecretProtector"/>.
/// </summary>
public sealed record EmailSettings(
    bool Enabled,
    string SmtpHost,
    int SmtpPort,
    SmtpSecurity Security,
    string? Username,
    string? Password,
    string FromAddress,
    string FromName,
    string? AppBaseUrl,
    NotificationSeverity MinSeverity);
