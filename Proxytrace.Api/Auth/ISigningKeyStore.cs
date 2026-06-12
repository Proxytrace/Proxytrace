namespace Proxytrace.Api.Auth;

/// <summary>
/// Persists a generated local-auth signing key so it survives process restarts.
/// </summary>
internal interface ISigningKeyStore
{
    /// <summary>
    /// Returns the previously persisted signing key, or null when none exists.
    /// </summary>
    string? Load();

    void Persist(string signingKey);
}
