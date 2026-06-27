using Microsoft.AspNetCore.DataProtection;
using Proxytrace.Domain.Security;

namespace Proxytrace.Infrastructure.Security.Internal;

internal sealed class DataProtectionSecretProtector : ISecretProtector
{
    private readonly IDataProtector protector;

    public DataProtectionSecretProtector(IDataProtectionProvider provider)
    {
        protector = provider.CreateProtector("Proxytrace.Secrets.v1");
    }

    public string Protect(string plaintext) => protector.Protect(plaintext);

    public string Unprotect(string ciphertext) => protector.Unprotect(ciphertext);
}
