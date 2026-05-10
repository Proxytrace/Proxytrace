using System.Threading.Channels;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Trsr.Domain.Events;

namespace Trsr.Application.Statistics.Internal;

internal class StatisticsHostedService : BackgroundService
{
    private static readonly TimeSpan FlushInterval = TimeSpan.FromMilliseconds(250);

    private readonly IEntityEventService entityEvents;
    private readonly IReadOnlyDictionary<Type, IReadOnlyList<IStatsProjector>> projectorsByType;
    private readonly ILogger<StatisticsHostedService> logger;

    public StatisticsHostedService(
        IEntityEventService entityEvents,
        IEnumerable<IStatsProjector> projectors,
        ILogger<StatisticsHostedService> logger)
    {
        this.entityEvents = entityEvents;
        this.logger = logger;
        this.projectorsByType = projectors
            .GroupBy(p => p.EntityType)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<IStatsProjector>)g.ToArray());
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (projectorsByType.Count == 0)
        {
            logger.LogInformation("No stats projectors registered; statistics hosted service idle.");
            return;
        }

        ChannelReader<EntityChangedEvent> reader = entityEvents.Subscribe(stoppingToken);

        Dictionary<(Type, Guid), EntityChangedEvent> pending = new();

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (!await reader.WaitToReadAsync(stoppingToken))
                {
                    break;
                }

                while (reader.TryRead(out EntityChangedEvent? evt))
                {
                    if (!projectorsByType.ContainsKey(evt.EntityType))
                    {
                        continue;
                    }

                    pending[(evt.EntityType, evt.EntityId)] = evt;
                }

                if (pending.Count == 0)
                {
                    continue;
                }

                await Task.Delay(FlushInterval, stoppingToken);

                while (reader.TryRead(out EntityChangedEvent? evt))
                {
                    if (!projectorsByType.ContainsKey(evt.EntityType))
                    {
                        continue;
                    }

                    pending[(evt.EntityType, evt.EntityId)] = evt;
                }

                EntityChangedEvent[] batch = pending.Values.ToArray();
                pending.Clear();

                foreach (EntityChangedEvent evt in batch)
                {
                    foreach (IStatsProjector projector in projectorsByType[evt.EntityType])
                    {
                        try
                        {
                            await projector.ProjectAsync(evt.EntityId, evt.ChangeType, stoppingToken);
                        }
                        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                        {
                            return;
                        }
                        catch (Exception ex)
                        {
                            logger.LogError(ex,
                                "Stats projector {Projector} failed for {EntityType} {EntityId}",
                                projector.GetType().Name, evt.EntityType.Name, evt.EntityId);
                        }
                    }
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Statistics hosted service drain loop encountered an error");
            }
        }
    }
}
