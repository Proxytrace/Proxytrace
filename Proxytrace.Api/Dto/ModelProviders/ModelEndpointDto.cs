namespace Proxytrace.Api.Dto.ModelProviders;

public record ModelEndpointDto(
    Guid Id,
    string ModelName,
    Guid ProviderId,
    string ProviderName,
    decimal? InputTokenCost,
    decimal? OutputTokenCost,
    // Cached-input price is auto-fetched from the LiteLLM catalog and surfaced read-only — it is not
    // part of the create/update pricing requests below.
    decimal? CachedInputTokenCost,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record CreateModelEndpointRequest(
    string ModelName,
    decimal? InputTokenCost,
    decimal? OutputTokenCost);

public record UpdateModelEndpointPricingRequest(
    decimal? InputTokenCost, decimal? OutputTokenCost);
