namespace Proxytrace.Api.Dto.Setup;

public record CompleteSetupResponse(
    Guid ProviderId,
    Guid EndpointId,
    Guid ProjectId,
    string ApiKeyValue);
