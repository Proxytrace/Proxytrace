using System.Security.Cryptography;
using System.Text.Json;

namespace Trsr.Api.Auth;

internal static class SigningKeyProvider
{
    public static string EnsureSigningKey(IHostEnvironment env, string? configured)
    {
        if (!string.IsNullOrWhiteSpace(configured))
        {
            return configured;
        }

        var path = Path.Combine(env.ContentRootPath, "appsettings.local.json");
        if (File.Exists(path))
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(path));
            if (doc.RootElement.TryGetProperty("Authentication", out var auth)
                && auth.TryGetProperty("Local", out var local)
                && local.TryGetProperty("SigningKey", out var key)
                && key.GetString() is { Length: > 0 } existing)
            {
                return existing;
            }
        }

        var bytes = new byte[64];
        RandomNumberGenerator.Fill(bytes);
        var generated = Convert.ToBase64String(bytes);

        var doc2 = new
        {
            Authentication = new { Local = new { SigningKey = generated } }
        };
        File.WriteAllText(path, JsonSerializer.Serialize(doc2, new JsonSerializerOptions { WriteIndented = true }));
        return generated;
    }
}
