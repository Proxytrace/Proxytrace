using System.Threading.Channels;

namespace Proxytrace.Application.Streaming;

public record AnomalyFlaggedEvent(
    Guid AgentCallId,
    Guid AgentId,
    Guid ProjectId,
    Guid DetectorId,
    string DetectorName,
    bool Blocked = false);

public interface ICustomAnomalyBroadcaster
{
    ChannelReader<AnomalyFlaggedEvent> Subscribe(CancellationToken cancellationToken);

    void Publish(AnomalyFlaggedEvent evt);
}
