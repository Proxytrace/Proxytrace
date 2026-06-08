namespace Proxytrace.Api.Dto.AgentCalls;

public record TraceHistogramBucketDto(DateTimeOffset Start, int Total, int Errors);
