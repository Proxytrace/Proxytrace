using Proxytrace.Domain.ModelProvider;

namespace Proxytrace.Application.Demo;

/// <summary>
/// Optional real LLM endpoint for kiosk mode, bound from the <c>Kiosk:Endpoint</c>
/// configuration section. When configured, kiosk seeding creates a real model provider,
/// model and endpoint and uses it as the project's system endpoint and for the demo agents,
/// turning the kiosk into a fully functional demo (Tracey chat and test runs hit a real LLM).
/// </summary>
public sealed record KioskEndpointOptions
{
    /// <summary>
    /// The provider's API base URL (e.g. <c>https://api.openai.com/v1</c>).
    /// </summary>
    public string? BaseUrl { get; init; }

    /// <summary>
    /// The provider API key used to authenticate upstream LLM calls.
    /// </summary>
    public string? ApiKey { get; init; }

    /// <summary>
    /// The model name to register (e.g. <c>gpt-4o</c>).
    /// </summary>
    public string? Model { get; init; }

    /// <summary>
    /// The provider kind, parsed to <see cref="ModelProviderKind"/> (e.g. <c>OpenAi</c>, <c>Anthropic</c>).
    /// </summary>
    public string Kind { get; init; } = nameof(ModelProviderKind.OpenAi);

    /// <summary>
    /// Display name for the seeded provider.
    /// </summary>
    public string ProviderName { get; init; } = "Kiosk Provider";

    /// <summary>
    /// Optional price of 1M input tokens (EUR).
    /// </summary>
    public decimal? InputTokenCost { get; init; }

    /// <summary>
    /// Optional price of 1M output tokens (EUR).
    /// </summary>
    public decimal? OutputTokenCost { get; init; }

    /// <summary>
    /// Whether all required fields (<see cref="BaseUrl"/>, <see cref="ApiKey"/>, <see cref="Model"/>)
    /// are present.
    /// </summary>
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(BaseUrl)
        && !string.IsNullOrWhiteSpace(ApiKey)
        && !string.IsNullOrWhiteSpace(Model);

    /// <summary>
    /// Validates and resolves the options into a strongly-typed endpoint descriptor.
    /// Throws when the section is present but incomplete or invalid.
    /// </summary>
    public ResolvedKioskEndpoint Resolve()
    {
        if (string.IsNullOrWhiteSpace(BaseUrl)
            || string.IsNullOrWhiteSpace(ApiKey)
            || string.IsNullOrWhiteSpace(Model))
        {
            throw new InvalidOperationException(
                "Kiosk:Endpoint is partially configured. BaseUrl, ApiKey and Model are all required.");
        }

        if (!Uri.TryCreate(BaseUrl, UriKind.Absolute, out var baseUri))
        {
            throw new InvalidOperationException($"Kiosk:Endpoint:BaseUrl is not a valid absolute URL: '{BaseUrl}'.");
        }

        if (!Enum.TryParse<ModelProviderKind>(Kind, ignoreCase: true, out var kind)
            || kind == ModelProviderKind.Unknown)
        {
            throw new InvalidOperationException(
                $"Kiosk:Endpoint:Kind '{Kind}' is not a valid provider kind "
                + $"({nameof(ModelProviderKind.OpenAi)}, {nameof(ModelProviderKind.Anthropic)}, "
                + $"{nameof(ModelProviderKind.OpenAiCompatible)}).");
        }

        return new ResolvedKioskEndpoint(
            baseUri,
            ApiKey,
            Model,
            kind,
            ProviderName,
            InputTokenCost,
            OutputTokenCost);
    }
}

/// <summary>
/// A validated, non-null kiosk endpoint descriptor produced by <see cref="KioskEndpointOptions.Resolve"/>.
/// </summary>
public sealed record ResolvedKioskEndpoint(
    Uri BaseUrl,
    string ApiKey,
    string Model,
    ModelProviderKind Kind,
    string ProviderName,
    decimal? InputTokenCost,
    decimal? OutputTokenCost);
