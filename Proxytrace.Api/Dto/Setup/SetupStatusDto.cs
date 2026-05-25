namespace Proxytrace.Api.Dto.Setup;

public record SetupStatusDto
{
    public required bool IsConfigured { get; init; }
}
