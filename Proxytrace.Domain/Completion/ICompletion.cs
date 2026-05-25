using Proxytrace.Domain.Message;
using Proxytrace.Domain.Usage;

namespace Proxytrace.Domain.Completion;

public interface ICompletion : IDomainObject
{
    public delegate ICompletion Create(
        AssistantMessage response,
        TokenUsage? usage,
        TimeSpan latency);
    
    AssistantMessage Response { get; }
    TokenUsage? Usage { get; }
    TimeSpan Latency { get; }
}