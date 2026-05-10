using Trsr.Domain.Message;
using Trsr.Domain.Usage;

namespace Trsr.Domain.ModelEndpoint;

/// <summary>
/// A streaming chunk from <see cref="IModelClient.StreamAsync"/>.
/// One of: <see cref="TextDelta"/>, <see cref="ToolRequested"/>, <see cref="Completed"/>.
/// </summary>
public abstract record ModelStreamUpdate;

public sealed record TextDelta(string Text) : ModelStreamUpdate;

public sealed record ToolRequested(ToolRequest Request) : ModelStreamUpdate;

public sealed record Completed(
    TokenUsage? Usage,
    TimeSpan Latency,
    string? FinishReason) : ModelStreamUpdate;
