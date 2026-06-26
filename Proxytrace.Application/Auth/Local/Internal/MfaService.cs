using System.Security.Cryptography;
using Proxytrace.Application.Security;
using Proxytrace.Domain;
using Proxytrace.Domain.MfaBackupCode;
using Proxytrace.Domain.User;
using Proxytrace.Domain.UserTotpEnrollment;

namespace Proxytrace.Application.Auth.Local.Internal;

internal sealed class MfaService : IMfaService
{
    private const int BackupCodeCount = 10;
    private const int BackupCodeChars = 10;

    // 32-symbol alphabet without the visually ambiguous I/O/0/1.
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private readonly IUserTotpEnrollmentRepository enrollments;
    private readonly IMfaBackupCodeRepository backupCodes;
    private readonly IUserTotpEnrollment.CreateNew createEnrollment;
    private readonly IMfaBackupCode.CreateNew createBackupCode;
    private readonly ITotpService totp;
    private readonly IMfaChallengeService challenges;
    private readonly IUserRepository users;
    private readonly ILocalTokenIssuer tokenIssuer;
    private readonly ISecretHasher hasher;
    private readonly IPasswordService passwords;
    private readonly ITransaction transaction;

    public MfaService(
        IUserTotpEnrollmentRepository enrollments,
        IMfaBackupCodeRepository backupCodes,
        IUserTotpEnrollment.CreateNew createEnrollment,
        IMfaBackupCode.CreateNew createBackupCode,
        ITotpService totp,
        IMfaChallengeService challenges,
        IUserRepository users,
        ILocalTokenIssuer tokenIssuer,
        ISecretHasher hasher,
        IPasswordService passwords,
        ITransaction transaction)
    {
        this.enrollments = enrollments;
        this.backupCodes = backupCodes;
        this.createEnrollment = createEnrollment;
        this.createBackupCode = createBackupCode;
        this.totp = totp;
        this.challenges = challenges;
        this.users = users;
        this.tokenIssuer = tokenIssuer;
        this.hasher = hasher;
        this.passwords = passwords;
        this.transaction = transaction;
    }

    public async Task<bool> IsEnabledAsync(Guid userId, CancellationToken cancellationToken = default)
        => await enrollments.FindByUserAsync(userId, cancellationToken) is { IsConfirmed: true };

    public async Task<MfaSetup?> SetupAsync(IUser user, CancellationToken cancellationToken = default)
    {
        var existing = await enrollments.FindByUserAsync(user.Id, cancellationToken);
        if (existing is { IsConfirmed: true })
        {
            // Already enabled — re-enrolling requires an explicit disable first.
            return null;
        }

        var secret = totp.GenerateSecret();
        return await transaction.InvokeAsync(async () =>
        {
            // Replace any stale, never-confirmed enrollment so a user can restart setup cleanly.
            if (existing is not null)
            {
                await existing.RemoveAsync(cancellationToken);
            }

            var enrollment = createEnrollment(user, secret);
            await enrollment.AddAsync(cancellationToken);
            return new MfaSetup(secret, totp.BuildOtpAuthUri(user.Email, secret));
        }, cancellationToken);
    }

    public async Task<IReadOnlyList<string>?> ActivateAsync(IUser user, string code, CancellationToken cancellationToken = default)
    {
        var enrollment = await enrollments.FindByUserAsync(user.Id, cancellationToken);
        if (enrollment is null || enrollment.IsConfirmed)
        {
            return null;
        }

        if (!totp.TryVerify(enrollment.Secret, code, enrollment.LastUsedStep, out var matchedStep))
        {
            return null;
        }

        return await transaction.InvokeAsync<IReadOnlyList<string>>(async () =>
        {
            await enrollment.Confirm(matchedStep, cancellationToken);
            var (display, hashes) = GenerateBackupCodes();
            foreach (var hash in hashes)
            {
                await createBackupCode(user, hash).AddAsync(cancellationToken);
            }
            return display;
        }, cancellationToken);
    }

    public async Task<bool?> DisableAsync(IUser user, string password, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(user.PasswordHash) || !passwords.Verify(user, user.PasswordHash, password))
        {
            return null;
        }

        return await RemoveEnrollmentAsync(user.Id, cancellationToken);
    }

    public Task<bool> AdminDisableAsync(Guid userId, CancellationToken cancellationToken = default)
        => RemoveEnrollmentAsync(userId, cancellationToken);

    public async Task<LoginResult?> VerifyChallengeAsync(string challengeToken, string code, CancellationToken cancellationToken = default)
    {
        var userId = challenges.Peek(challengeToken);
        if (userId is null)
        {
            return null;
        }

        var user = await users.FindAsync(userId.Value, cancellationToken);
        var enrollment = user is null ? null : await enrollments.FindByUserAsync(user.Id, cancellationToken);
        if (user is null || enrollment is not { IsConfirmed: true })
        {
            challenges.Consume(challengeToken);
            return null;
        }

        // Primary path: a current TOTP code.
        if (totp.TryVerify(enrollment.Secret, code, enrollment.LastUsedStep, out var matchedStep))
        {
            await enrollment.RecordUsedStep(matchedStep, cancellationToken);
            challenges.Consume(challengeToken);
            return Issue(user);
        }

        // Fallback: a one-time backup code.
        var normalized = NormalizeBackupCode(code);
        if (normalized.Length > 0)
        {
            var backup = await backupCodes.FindByCodeHashAsync(user.Id, hasher.Hash(normalized), cancellationToken);
            if (backup is { IsConsumed: false })
            {
                await backup.MarkConsumedAsync(cancellationToken);
                challenges.Consume(challengeToken);
                return Issue(user);
            }
        }

        challenges.RegisterFailure(challengeToken);
        return null;
    }

    private Task<bool> RemoveEnrollmentAsync(Guid userId, CancellationToken cancellationToken)
        => transaction.InvokeAsync(async () =>
        {
            // Per-row removes (not a bulk ExecuteDelete) so the in-memory provider — used by tests and
            // the kiosk — keeps working. See the executedelete-breaks-inmemory-provider note.
            var codes = await backupCodes.ListByUserAsync(userId, cancellationToken);
            foreach (var backup in codes)
            {
                await backup.RemoveAsync(cancellationToken);
            }

            var enrollment = await enrollments.FindByUserAsync(userId, cancellationToken);
            if (enrollment is not null)
            {
                await enrollment.RemoveAsync(cancellationToken);
            }

            return enrollment is not null;
        }, cancellationToken);

    private LoginResult Issue(IUser user)
    {
        var issued = tokenIssuer.Issue(user);
        return new LoginResult(user, issued.Token, issued.ExpiresAt);
    }

    private (IReadOnlyList<string> Display, IReadOnlyList<string> Hashes) GenerateBackupCodes()
    {
        var display = new List<string>(BackupCodeCount);
        var hashes = new List<string>(BackupCodeCount);
        for (var i = 0; i < BackupCodeCount; i++)
        {
            var raw = RandomCode(BackupCodeChars);
            display.Add($"{raw[..5]}-{raw[5..]}");
            hashes.Add(hasher.Hash(raw));
        }
        return (display, hashes);
    }

    private static string RandomCode(int length)
    {
        var chars = new char[length];
        for (var i = 0; i < length; i++)
        {
            chars[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        }
        return new string(chars);
    }

    private static string NormalizeBackupCode(string code)
        => new string((code ?? string.Empty).Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
}
