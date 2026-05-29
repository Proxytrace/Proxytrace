using Microsoft.Extensions.Configuration;

namespace Proxytrace.Application.Tests.Optimization;

/// <summary>
/// Reads optimizer integration-test settings from appsettings.local.json.
/// Tests are skipped when the file is missing or has placeholder values.
/// </summary>
internal sealed class OptimizerTestConfiguration
{
    private const string SectionName = "OptimizerTests";

    public string Endpoint { get; }
    public string ApiKey { get; }
    public string Model { get; }

    private OptimizerTestConfiguration(string endpoint, string apiKey, string model)
    {
        Endpoint = endpoint;
        ApiKey = apiKey;
        Model = model;
    }

    /// <summary>
    /// Attempts to load configuration. Returns null when settings are unavailable.
    /// </summary>
    public static OptimizerTestConfiguration? TryLoad()
    {
        var config = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.local.json", optional: true)
            .Build();

        var section = config.GetSection(SectionName);
        string? endpoint = section["Endpoint"];
        string? apiKey = section["ApiKey"];
        string? model = section["Model"];

        if (string.IsNullOrWhiteSpace(apiKey) || apiKey.Contains("your-key-here"))
        {
            return null;
        }

        return new OptimizerTestConfiguration(
            endpoint ?? "https://api.openai.com/v1",
            apiKey,
            model ?? "gpt-4o-mini");
    }
}
