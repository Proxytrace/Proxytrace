using Proxytrace.Domain.ModelProvider;

namespace Proxytrace.Api.Dto.ModelProviders;

public record ModelProviderDto(
    Guid Id,
    string Name,
    string Endpoint,
    string UpstreamApiKey,
    ModelProviderKind Kind,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record CreateModelProviderRequest(string Name, string Endpoint, string UpstreamApiKey, ModelProviderKind Kind);

public record UpdateModelProviderRequest(string Name, string Endpoint, string UpstreamApiKey, ModelProviderKind Kind);
