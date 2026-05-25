using Proxytrace.Domain.ModelProvider;

namespace Proxytrace.Api.Dto.Setup;

public record ListModelsRequest(
    string ProviderName,
    string ProviderEndpoint,
    string ProviderUpstreamApiKey,
    ModelProviderKind ProviderKind);
