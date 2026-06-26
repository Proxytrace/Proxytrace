using Proxytrace.Domain.User;

namespace Proxytrace.Application.Auth.Local;

/// <summary>The data a client needs to enroll an authenticator app: the secret and its otpauth URI.</summary>
public sealed record MfaSetup(string Secret, string OtpAuthUri);

/// <summary>
/// Drives per-user TOTP MFA: starting enrollment, confirming it (which mints backup codes), disabling
/// it, and verifying the second factor during the two-step login. Local-auth only.
/// </summary>
public interface IMfaService
{
    /// <summary>Whether the user has a confirmed (enforced) TOTP enrollment.</summary>
    Task<bool> IsEnabledAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Starts (or restarts) enrollment: generates a fresh secret and a pending enrollment, returning
    /// the secret + otpauth URI. Returns <see langword="null"/> when MFA is already confirmed for the
    /// user (they must disable it first).
    /// </summary>
    Task<MfaSetup?> SetupAsync(IUser user, CancellationToken cancellationToken = default);

    /// <summary>
    /// Confirms a pending enrollment by verifying a first code. On success the enrollment becomes
    /// enforced and a fresh batch of one-time backup codes is returned (shown once). Returns
    /// <see langword="null"/> when there is no pending enrollment or the code is invalid.
    /// </summary>
    Task<IReadOnlyList<string>?> ActivateAsync(IUser user, string code, CancellationToken cancellationToken = default);

    /// <summary>
    /// Self-service disable: removes the enrollment and all backup codes after re-authenticating with
    /// the account password. Returns <see langword="null"/> when the password is wrong, <c>true</c>
    /// when an enrollment was removed, or <c>false</c> when none existed (idempotent).
    /// </summary>
    Task<bool?> DisableAsync(IUser user, string password, CancellationToken cancellationToken = default);

    /// <summary>Admin lockout recovery: removes a user's enrollment and backup codes unconditionally.</summary>
    Task<bool> AdminDisableAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Completes the second step of login: validates <paramref name="code"/> (a TOTP code or a backup
    /// code) against the challenge ticket and, on success, issues a session. Returns
    /// <see langword="null"/> when the ticket or the code is invalid.
    /// </summary>
    Task<LoginResult?> VerifyChallengeAsync(string challengeToken, string code, CancellationToken cancellationToken = default);
}
