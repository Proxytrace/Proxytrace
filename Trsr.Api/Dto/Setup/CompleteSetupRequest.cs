using Trsr.Domain.ModelProvider;

namespace Trsr.Api.Dto.Setup;

public record CompleteSetupRequest(
    string ProviderName,
    string ProviderEndpoint,
    string ProviderUpstreamApiKey,
    ModelProviderKind ProviderKind,
    string ModelName,
    decimal? InputTokenCost,
    decimal? OutputTokenCost,
    string ProjectName,
    string ApiKeyName);
