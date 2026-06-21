namespace Proxytrace.Application.Security;

/// <summary>
/// Deterministic one-way hash for verify-only secrets (inbound API keys, invite tokens). Produces a
/// blind index used for equality lookups; key-ring-independent so those lookups survive a lost
/// <c>PROXYTRACE_DATA_DIR</c>. Suitable because the secrets are high-entropy (256-bit CSPRNG) — a
/// database dump cannot reverse or forge them. Not for passwords (use <c>IPasswordService</c>).
/// </summary>
public interface ISecretHasher
{
    /// <summary>Returns the hex-encoded SHA-256 of <paramref name="value"/>.</summary>
    string Hash(string value);
}
