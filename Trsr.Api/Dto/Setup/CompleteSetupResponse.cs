namespace Trsr.Api.Dto.Setup;

public record CompleteSetupResponse(
    Guid UserId,
    Guid ProviderId,
    Guid EndpointId,
    Guid ProjectId,
    string ApiKeyValue);
