using Proxytrace.Domain.ApiKey;

namespace Proxytrace.Api.Dto.ApiKeys;

public record ApiKeyDto(
    Guid Id,
    string Name,
    string KeyValue,
    Guid ProjectId,
    string ProjectName,
    Guid ProviderId,
    string ProviderName,
    IReadOnlyList<ApiKeyScopes> Scopes,
    Guid OwnerId,
    string OwnerEmail,
    DateTimeOffset CreatedAt);

public record CreateApiKeyRequest(
    string Name,
    Guid ProjectId,
    IReadOnlyList<ApiKeyScopes>? Scopes = null,
    Guid? UserId = null);
