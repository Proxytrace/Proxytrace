using Trsr.Domain.ModelProvider;

namespace Trsr.Api.Dto.ModelProviders;

public record ModelProviderDto(
    Guid Id,
    string Name,
    string Endpoint,
    string UpstreamApiKey,
    ModelProviderKind Kind,
    Guid OrganizationId,
    string OrganizationName,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record CreateModelProviderRequest(string Name, string Endpoint, string UpstreamApiKey, ModelProviderKind Kind, Guid OrganizationId);

public record UpdateModelProviderRequest(string Name, string Endpoint, string UpstreamApiKey, ModelProviderKind Kind);
