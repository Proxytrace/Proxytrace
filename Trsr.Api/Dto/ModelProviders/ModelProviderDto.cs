namespace Trsr.Api.Dto.ModelProviders;

public record ModelProviderDto(
    Guid Id,
    string Name,
    string Endpoint,
    string UpstreamApiKey,
    Guid OrganizationId,
    string OrganizationName,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record CreateModelProviderRequest(string Name, string Endpoint, string UpstreamApiKey, Guid OrganizationId);

public record UpdateModelProviderRequest(string Name, string Endpoint, string UpstreamApiKey);
