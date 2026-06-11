using Proxytrace.Domain.ModelProvider;

namespace Proxytrace.Api.Dto.Setup;

public record CompleteSetupRequest(
    string ProviderName,
    string ProviderEndpoint,
    string ProviderUpstreamApiKey,
    ModelProviderKind ProviderKind,
    string ModelName,
    string ProjectName);
