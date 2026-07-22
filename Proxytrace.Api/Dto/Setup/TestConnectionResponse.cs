namespace Proxytrace.Api.Dto.Setup;

public record TestConnectionResponse(
    bool Success,
    string? ErrorCode,
    int ModelCount,
    string? Error = null,
    Guid? ErrorId = null);
