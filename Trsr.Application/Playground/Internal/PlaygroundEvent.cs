namespace Trsr.Application.Playground.Internal;

public abstract record PlaygroundEvent;

public sealed record TokenEvent(string Delta) : PlaygroundEvent;

public sealed record ToolRequestEvent(string Id, string Name, string Arguments) : PlaygroundEvent;

public sealed record DoneEvent(
    ulong InputTokens,
    ulong OutputTokens,
    long LatencyMs,
    decimal? CostEur,
    string? FinishReason) : PlaygroundEvent;

public sealed record ErrorEvent(string Message) : PlaygroundEvent;
