using System.Security.Cryptography;

namespace Proxytrace.Api.Auth;

internal sealed class SigningKeyProvider : ISigningKeyProvider
{
    private const int MinKeyLength = 32;
    private const int GeneratedKeyByteLength = 64;

    private readonly ISigningKeyStore store;

    public SigningKeyProvider(ISigningKeyStore store)
    {
        this.store = store;
    }

    public string EnsureSigningKey(string? configured)
    {
        if (!string.IsNullOrWhiteSpace(configured))
        {
            if (configured.Length < MinKeyLength)
            {
                throw new InvalidOperationException(
                    $"Configured local signing key must be at least {MinKeyLength} characters.");
            }

            return configured;
        }

        var generated = GenerateKey();
        store.Persist(generated);
        return generated;
    }

    private static string GenerateKey()
    {
        var bytes = new byte[GeneratedKeyByteLength];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes);
    }
}
