using System.Security.Cryptography;
using System.Text;

namespace Trsr.Domain.License;

public static class LicenseHasher
{
    public static string Hash(string email)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(email.ToLowerInvariant().Trim()));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
