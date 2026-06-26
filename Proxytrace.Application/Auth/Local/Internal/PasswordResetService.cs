using System.Net;
using System.Security.Cryptography;
using Microsoft.Extensions.Logging;
using Proxytrace.Application.Notifications;
using Proxytrace.Application.Security;
using Proxytrace.Domain;
using Proxytrace.Domain.PasswordResetToken;
using Proxytrace.Domain.User;
using Proxytrace.Domain.UserTotpEnrollment;

namespace Proxytrace.Application.Auth.Local.Internal;

internal sealed class PasswordResetService : IPasswordResetService
{
    private const int TokenBytes = 32;
    private static readonly TimeSpan Ttl = TimeSpan.FromHours(1);

    private readonly IPasswordResetTokenRepository tokens;
    private readonly IUserRepository users;
    private readonly IPasswordResetToken.CreateNew createToken;
    private readonly IPasswordService passwords;
    private readonly ILocalTokenIssuer tokenIssuer;
    private readonly ISecretHasher hasher;
    private readonly IEmailSettingsStore emailSettings;
    private readonly IEmailSender emailSender;
    private readonly ITransaction transaction;
    private readonly IUserTotpEnrollmentRepository enrollments;
    private readonly IMfaChallengeService challenges;
    private readonly ILogger<PasswordResetService> logger;

    public PasswordResetService(
        IPasswordResetTokenRepository tokens,
        IUserRepository users,
        IPasswordResetToken.CreateNew createToken,
        IPasswordService passwords,
        ILocalTokenIssuer tokenIssuer,
        ISecretHasher hasher,
        IEmailSettingsStore emailSettings,
        IEmailSender emailSender,
        ITransaction transaction,
        IUserTotpEnrollmentRepository enrollments,
        IMfaChallengeService challenges,
        ILogger<PasswordResetService> logger)
    {
        this.tokens = tokens;
        this.users = users;
        this.createToken = createToken;
        this.passwords = passwords;
        this.tokenIssuer = tokenIssuer;
        this.hasher = hasher;
        this.emailSettings = emailSettings;
        this.emailSender = emailSender;
        this.transaction = transaction;
        this.enrollments = enrollments;
        this.challenges = challenges;
        this.logger = logger;
    }

    public async Task RequestResetAsync(string email, Func<string, string> buildResetUrl, CancellationToken cancellationToken = default)
    {
        var user = await users.FindByEmailAsync(email, cancellationToken);
        if (user is null || string.IsNullOrEmpty(user.PasswordHash))
        {
            // Anti-enumeration: never reveal whether the email maps to a local account, and don't issue
            // a token for an OIDC-only user (no local password to reset).
            return;
        }

        var issued = await IssueAsync(user, buildResetUrl, cancellationToken);
        var resetUrl = issued.Link;
        var minutes = (int)Ttl.TotalMinutes;

        var settings = await emailSettings.GetAsync(cancellationToken);
        if (settings is { Enabled: true })
        {
            try
            {
                await SendResetEmailAsync(user, resetUrl, minutes, cancellationToken);
                return;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                // SMTP is configured but the send failed — fall back to the operator log so the reset
                // is still recoverable rather than surfacing a 500 to the (anonymous) caller.
                logger.LogWarning(
                    ex,
                    "Failed to email password reset to {Email}; one-time reset link (valid {Minutes} min): {ResetUrl}",
                    user.Email, minutes, resetUrl);
                return;
            }
        }

        // SMTP is not configured: surface the link to whoever operates the server so a locked-out user
        // (including a sole admin) can still recover. Logged at Warning so it is findable in the log.
        logger.LogWarning(
            "Password reset requested for {Email} but email delivery is not configured. " +
            "Provide this one-time reset link (valid {Minutes} min) to the user: {ResetUrl}",
            user.Email, minutes, resetUrl);
    }

    public async Task<PasswordResetLink?> IssueResetLinkAsync(Guid userId, Func<string, string> buildResetUrl, CancellationToken cancellationToken = default)
    {
        var user = await users.FindAsync(userId, cancellationToken);
        if (user is null)
        {
            return null;
        }

        return await IssueAsync(user, buildResetUrl, cancellationToken);
    }

    public Task<LoginOutcome?> CompleteResetAsync(string token, string newPassword, CancellationToken cancellationToken = default)
        => transaction.InvokeAsync<LoginOutcome?>(async () =>
        {
            var resetToken = await tokens.FindByTokenAsync(token, cancellationToken);
            if (resetToken is null || resetToken.IsConsumed || resetToken.IsExpired(DateTimeOffset.UtcNow))
            {
                return null;
            }

            var user = resetToken.User;
            var hash = passwords.Hash(user, newPassword);
            var updated = await user.ChangePasswordHash(hash, cancellationToken);
            await resetToken.MarkConsumedAsync(cancellationToken);

            // A reset proves email control, not possession of the second factor: an MFA-enabled account
            // must still pass the TOTP challenge before a session is issued.
            if (await enrollments.FindByUserAsync(updated.Id, cancellationToken) is { IsConfirmed: true })
            {
                var challenge = challenges.Issue(updated);
                return new MfaRequired(updated, challenge.Token, challenge.ExpiresAt);
            }

            var issued = tokenIssuer.Issue(updated);
            return new LoginSucceeded(updated, issued.Token, issued.ExpiresAt);
        });

    // Persist only the hash of the token; the raw value is returned once so the caller can build the
    // reset link, and is unrecoverable afterwards.
    private async Task<PasswordResetLink> IssueAsync(IUser user, Func<string, string> buildResetUrl, CancellationToken cancellationToken)
    {
        var rawToken = GenerateToken();
        var expiresAt = DateTimeOffset.UtcNow + Ttl;
        var token = createToken(user, hasher.Hash(rawToken), expiresAt);
        await token.AddAsync(cancellationToken);
        return new PasswordResetLink(buildResetUrl(rawToken), expiresAt);
    }

    private async Task SendResetEmailAsync(IUser user, string resetUrl, int minutes, CancellationToken cancellationToken)
    {
        const string subject = "Reset your Proxytrace password";
        var url = WebUtility.HtmlEncode(resetUrl);
        var html =
            "<h2>Reset your password</h2>" +
            "<p>We received a request to reset the password for your Proxytrace account.</p>" +
            $"<p><a href=\"{url}\">Choose a new password</a></p>" +
            $"<p>This link is valid for {minutes} minutes. If you did not request a reset, you can safely ignore this email.</p>";
        var text =
            "Reset your Proxytrace password\n\n" +
            "We received a request to reset the password for your Proxytrace account.\n\n" +
            $"Open this link to choose a new password (valid for {minutes} minutes):\n{resetUrl}\n\n" +
            "If you did not request a reset, you can safely ignore this email.";
        await emailSender.SendAsync(new EmailMessage(user.Email, user.Email, subject, html, text), cancellationToken);
    }

    private static string GenerateToken()
    {
        var bytes = new byte[TokenBytes];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }
}
