namespace Proxytrace.Application.Streaming.Internal;

internal sealed class TheoryBroadcaster : AgentScopedBroadcaster<TheoryStatusChangedEvent>, ITheoryBroadcaster
{
    protected override Guid KeyOf(TheoryStatusChangedEvent evt) => evt.AgentId;
}
