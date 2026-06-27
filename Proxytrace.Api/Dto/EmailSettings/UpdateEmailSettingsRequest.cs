using Proxytrace.Domain.Notifications;
using Proxytrace.Domain.Notification;

namespace Proxytrace.Api.Dto.EmailSettings;

/// <summary>
/// Saves operator email settings. <see cref="Password"/> is write-only: leave it null/empty to keep
/// the previously stored password; provide a value to replace it.
/// </summary>
public sealed record UpdateEmailSettingsRequest(
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
