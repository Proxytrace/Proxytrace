using JetBrains.Annotations;

namespace Proxytrace.Api.Dto.Error;

public sealed record ErrorReportRequest
{
    public required string Message { get; [UsedImplicitly] init; }
    public string? Stacktrace { get; [UsedImplicitly] init; }
    public string? Url { get; [UsedImplicitly] init; }
    public string? Type { get; [UsedImplicitly] init; }
    public string? Description { get; [UsedImplicitly] init; }
}