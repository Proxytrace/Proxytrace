using Trsr.Domain.ModelProvider;

namespace Trsr.Api.Dto.Setup;

public record ListModelsRequest(
    string ProviderName,
    string ProviderEndpoint,
    string ProviderUpstreamApiKey,
    ModelProviderKind ProviderKind);
