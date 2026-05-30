namespace Proxytrace.Licensing;

/// <summary>
/// Embedded license-signing public keys. The license server signs license JWTs with the
/// corresponding private key; the deployment verifies signatures against these keys.
/// Multiple keys may be active simultaneously to support key rotation.
/// </summary>
public static class LicensePublicKeys
{
    // RSA-2048 SubjectPublicKeyInfo (SPKI), base64-encoded DER.
    // TODO: replace before launch (tracking sub-issue) — this is a placeholder keypair whose
    // private half is NOT controlled by the production license server.
    private const string PlaceholderPublicKey =
        "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA7astIqPBn5ZV7EN3L3ZvtNYWThIC2onOR3Y41IfWvlF" +
        "dJKLHFqSSt2uENFXG4HbU/e/GnVSfcWoBvNLUa31Ds2t4ggmswy24NKaamTctWG11ETBsmcsFpCHuauDOF6vjfN" +
        "WV6PN/XSbYlmZF6rVUvD+7sJQfxBffKr40QKlaqAVNzhxIbK3x9DqvCCAU+ZI4rRtYStgBSdScDwl4JvT6qByG3" +
        "3IN7dm9HfV8ctfBsdOVer6GP4fExKM9SwMwY8v6gw7CBXCkh8hgtGiD1Ns9Xp13WP9DpHXugxKfQLmC7mgOfPCW" +
        "A1VtfheuFkhfe8cH0D4lj89Vdii+4RhyMh/TfQIDAQAB";

    /// <summary>
    /// Returns the currently active set of base64 SPKI public keys.
    /// </summary>
    public static IReadOnlyList<string> GetActiveKeys() => [PlaceholderPublicKey];
}
