namespace Proxytrace.Application.Notifications;

/// <summary>
/// Persistence for the single-row operator email/SMTP configuration. At most one row exists; the
/// SMTP password is stored encrypted and returned decrypted by <see cref="GetAsync"/>.
/// </summary>
public interface IEmailSettingsStore
{
    /// <summary>Returns the stored settings (password decrypted), or null when none have been saved.</summary>
    Task<EmailSettings?> GetAsync(CancellationToken cancellationToken = default);

    /// <summary>Persists the settings, replacing any previously stored row; encrypts the password.</summary>
    Task SaveAsync(EmailSettings settings, CancellationToken cancellationToken = default);
}
