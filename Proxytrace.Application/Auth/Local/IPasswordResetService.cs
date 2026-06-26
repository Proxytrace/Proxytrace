using Proxytrace.Domain.User;

namespace Proxytrace.Application.Auth.Local;

/// <summary>An admin-minted, one-time reset link and the moment it expires.</summary>
public sealed record PasswordResetLink(string Link, DateTimeOffset ExpiresAt);

/// <summary>
/// Drives the "forgot password" flow. A reset token is high-entropy, stored only as a hash, single-use
/// and short-lived. When SMTP is configured the reset link is emailed; otherwise it is logged for the
/// server operator so a locked-out user (including a sole admin) can still recover. An admin can also
/// mint a link directly. <paramref name="buildResetUrl"/> turns the raw token into a full link — the
/// URL format lives in the API layer (which has the request), this service owns the email-vs-log decision.
/// </summary>
public interface IPasswordResetService
{
    /// <summary>
    /// Self-service: issues a reset token for the account with <paramref name="email"/> (if one exists)
    /// and either emails or logs the link. Always completes silently, even for an unknown email, so the
    /// caller can return an identical response and never leak which addresses are registered.
    /// </summary>
    Task RequestResetAsync(string email, Func<string, string> buildResetUrl, CancellationToken cancellationToken = default);

    /// <summary>
    /// Admin-initiated: issues a reset token for <paramref name="userId"/> and returns the raw link
    /// (never emailed). Returns <see langword="null"/> if the user does not exist.
    /// </summary>
    Task<PasswordResetLink?> IssueResetLinkAsync(Guid userId, Func<string, string> buildResetUrl, CancellationToken cancellationToken = default);

    /// <summary>
    /// Consumes a reset token and sets the new password. Returns <see langword="null"/> if the token is
    /// unknown, expired or already used. On success returns a <see cref="LoginOutcome"/>: the session is
    /// issued outright, unless the account has confirmed TOTP MFA — then a second-factor challenge is
    /// required first (resetting the password proves email control, not possession of the device). The
    /// new password must already satisfy the policy.
    /// </summary>
    Task<LoginOutcome?> CompleteResetAsync(string token, string newPassword, CancellationToken cancellationToken = default);
}
