namespace Trsr.Api.Dto.ApiKeys;

public record ApiKeyDto(
    Guid Id,
    string Name,
    string KeyValue,
    Guid ProjectId,
    string ProjectName,
    Guid ProviderId,
    string ProviderName,
    DateTimeOffset CreatedAt);

public record CreateApiKeyRequest(string Name, Guid ProjectId);
