namespace Proxytrace.Api.Dto.ModelProviders;

public record ModelEndpointDto(
    Guid Id,
    string ModelName,
    Guid ProviderId,
    string ProviderName,
    decimal? InputTokenCost,
    decimal? OutputTokenCost,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record CreateModelEndpointRequest(
    string ModelName,
    decimal? InputTokenCost,
    decimal? OutputTokenCost);

public record UpdateModelEndpointPricingRequest(
    decimal? InputTokenCost, decimal? OutputTokenCost);
