using Proxytrace.Domain.Notifications;
using Proxytrace.Domain.Notification;

namespace Proxytrace.Storage.Internal.Entities.EmailSettings;

/// <summary>
/// The single-row operator email/SMTP configuration. <see cref="Password"/> holds ciphertext only
/// (encrypted via ISecretProtector in the store).
/// </summary>
internal record EmailSettingsEntity : Entity
{
    public required bool Enabled { get; init; }
    public required string SmtpHost { get; init; }
    public required int SmtpPort { get; init; }
    public required SmtpSecurity Security { get; init; }
    public string? Username { get; init; }
    public string? Password { get; init; }
    public required string FromAddress { get; init; }
    public required string FromName { get; init; }
    public string? AppBaseUrl { get; init; }
    public required NotificationSeverity MinSeverity { get; init; }
}
