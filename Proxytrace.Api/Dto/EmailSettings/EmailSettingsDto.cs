using Proxytrace.Application.Notifications;
using Proxytrace.Domain.Notification;

namespace Proxytrace.Api.Dto.EmailSettings;

/// <summary>Operator email settings for the admin UI. The SMTP password is never returned — only whether one is set.</summary>
public sealed record EmailSettingsDto(
    bool Enabled,
    string SmtpHost,
    int SmtpPort,
    SmtpSecurity Security,
    string? Username,
    bool PasswordSet,
    string FromAddress,
    string FromName,
    string? AppBaseUrl,
    NotificationSeverity MinSeverity);
