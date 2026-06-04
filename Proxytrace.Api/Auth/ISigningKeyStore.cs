namespace Proxytrace.Api.Auth;

/// <summary>
/// Persists a generated local-auth signing key so it survives process restarts.
/// </summary>
internal interface ISigningKeyStore
{
    void Persist(string signingKey);
}
