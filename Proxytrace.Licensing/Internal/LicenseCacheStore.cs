using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Proxytrace.Licensing.Internal;

/// <summary>
/// JSON-file backed <see cref="ILicenseCacheStore"/>. Missing or corrupt files are treated as an
/// empty cache; write failures are logged but never propagate.
/// </summary>
internal sealed class LicenseCacheStore : ILicenseCacheStore
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly string filePath;
    private readonly ILogger<LicenseCacheStore> logger;

    public LicenseCacheStore(LicensingConfiguration configuration, ILogger<LicenseCacheStore> logger)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        this.filePath = configuration.CacheFilePath;
        this.logger = logger;
    }

    public LicenseCacheEntry? Load()
    {
        try
        {
            if (!File.Exists(filePath))
                return null;

            var json = File.ReadAllText(filePath);
            return JsonSerializer.Deserialize<LicenseCacheEntry>(json, Options);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to read license cache at {Path}; ignoring", filePath);
            return null;
        }
    }

    public void Save(LicenseCacheEntry entry)
    {
        try
        {
            var directory = Path.GetDirectoryName(filePath);
            if (!string.IsNullOrEmpty(directory))
                Directory.CreateDirectory(directory);

            var json = JsonSerializer.Serialize(entry, Options);
            File.WriteAllText(filePath, json);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to persist license cache at {Path}", filePath);
        }
    }
}
