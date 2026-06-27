namespace Proxytrace.Domain.Security;

/// <summary>
/// Reversible at-rest encryption for secrets stored in the database (e.g. the SMTP password).
/// Backed by ASP.NET Data Protection; the key ring is persisted to <c>PROXYTRACE_DATA_DIR</c> in
/// container deployments so ciphertext survives restarts. Protects DB dumps/backups, not an attacker
/// holding both the database and the data dir.
/// </summary>
public interface ISecretProtector
{
    /// <summary>Encrypts <paramref name="plaintext"/> into an opaque, self-describing ciphertext string.</summary>
    string Protect(string plaintext);

    /// <summary>Reverses <see cref="Protect"/>.</summary>
    string Unprotect(string ciphertext);
}
