namespace Proxytrace.Application.Auth.Local;

/// <summary>
/// Time-based one-time password (RFC 6238) primitives: secret generation, the authenticator-app
/// enrollment URI, and code verification with a small clock-drift window and replay protection.
/// </summary>
public interface ITotpService
{
    /// <summary>Generates a fresh Base32-encoded TOTP shared secret.</summary>
    string GenerateSecret();

    /// <summary>
    /// Builds the <c>otpauth://totp/...</c> URI an authenticator app consumes (typically via QR code)
    /// to enroll the account.
    /// </summary>
    string BuildOtpAuthUri(string email, string secret);

    /// <summary>
    /// Verifies <paramref name="code"/> against <paramref name="secret"/> within a ±1 time-step window.
    /// Returns <see langword="true"/> and the matched time-step in <paramref name="matchedStep"/> on
    /// success. A code whose matched step is ≤ <paramref name="lastUsedStep"/> is rejected as a replay.
    /// </summary>
    bool TryVerify(string secret, string code, long? lastUsedStep, out long matchedStep);
}
