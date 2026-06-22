using System.Runtime.CompilerServices;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace Proxytrace.Messaging.Internal;

/// <summary>
/// Redis Streams transport. The proxy <c>XADD</c>s captured calls; the app reads them through a
/// consumer group (<c>XREADGROUP</c>) and acknowledges (<c>XACK</c>) only after successful
/// processing. Entries left pending by a crashed consumer are reclaimed via <c>XAUTOCLAIM</c>.
/// </summary>
internal sealed class RedisIngestionStream : IIngestionStream
{
    private const string PayloadField = "payload";

    private readonly IConnectionMultiplexer connection;
    private readonly MessagingConfiguration configuration;
    private readonly ILogger<RedisIngestionStream> logger;

    public RedisIngestionStream(
        IConnectionMultiplexer connection,
        MessagingConfiguration configuration,
        ILogger<RedisIngestionStream> logger)
    {
        this.connection = connection;
        this.configuration = configuration;
        this.logger = logger;
    }

    private IDatabase Database => connection.GetDatabase();

    public async Task PublishAsync(IngestMessage message, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var payload = JsonSerializer.Serialize(message);
        // Approximate MAXLEN trim bounds Redis memory if the consumer lags or the app is down.
        await Database.StreamAddAsync(
            configuration.Stream,
            PayloadField,
            payload,
            messageId: null,
            maxLength: configuration.MaxStreamLength,
            useApproximateMaxLength: true);
    }

    public async IAsyncEnumerable<IngestEnvelope> ConsumeAsync(
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        await EnsureGroupAsync();

        RedisValue reclaimCursor = "0-0";

        while (!cancellationToken.IsCancellationRequested)
        {
            // Reclaim entries stuck pending on a dead consumer before reading new ones.
            StreamAutoClaimResult claimed = await Database.StreamAutoClaimAsync(
                configuration.Stream,
                configuration.ConsumerGroup,
                configuration.ConsumerName,
                configuration.ReclaimIdleMs,
                reclaimCursor,
                count: configuration.BatchSize);
            reclaimCursor = claimed.NextStartId;

            var produced = false;
            foreach (IngestEnvelope envelope in ToEnvelopes(claimed.ClaimedEntries))
            {
                produced = true;
                yield return envelope;
            }

            StreamEntry[] entries = await Database.StreamReadGroupAsync(
                configuration.Stream,
                configuration.ConsumerGroup,
                configuration.ConsumerName,
                StreamPosition.NewMessages,
                count: configuration.BatchSize);

            foreach (IngestEnvelope envelope in ToEnvelopes(entries))
            {
                produced = true;
                yield return envelope;
            }

            if (!produced)
            {
                await Task.Delay(TimeSpan.FromMilliseconds(500), cancellationToken);
            }
        }
    }

    public async Task AckAsync(string messageId, CancellationToken cancellationToken = default)
        => await Database.StreamAcknowledgeAsync(configuration.Stream, configuration.ConsumerGroup, messageId);

    // Pending entries are reclaimed via XAUTOCLAIM and redelivered, so an unacked envelope reappears.
    public bool RedeliversUnacknowledged => true;

    public async Task<long> GetQueueDepthAsync(CancellationToken cancellationToken = default)
    {
        // Depth is observability-only and runs on the hot dashboard path. The multiplexer is
        // configured with AbortOnConnectFail=false, so when Redis is down a command does not fail
        // fast — it blocks until ConnectTimeout (~5s) before throwing. Bail out the moment the
        // multiplexer reports no connection so a Redis outage never stalls every dashboard load.
        if (!connection.IsConnected)
        {
            return 0L;
        }

        try
        {
            StreamGroupInfo[] groups = await Database.StreamGroupInfoAsync(configuration.Stream);
            foreach (StreamGroupInfo group in groups)
            {
                if (group.Name != configuration.ConsumerGroup)
                {
                    continue;
                }

                // Lag = entries added but not yet delivered to the group (the true backlog). It can
                // be null when Redis cannot compute it (e.g. after the stream was trimmed past the
                // group's position); fall back to the in-flight pending count.
                return group.Lag ?? group.PendingMessageCount;
            }
        }
        catch (RedisException ex)
        {
            // Depth is observability-only — never let a transient Redis error fail the caller.
            logger.LogDebug(ex, "Unable to read ingestion queue depth");
        }
        return 0L;
    }

    private IEnumerable<IngestEnvelope> ToEnvelopes(StreamEntry[] entries)
    {
        foreach (StreamEntry entry in entries)
        {
            IngestMessage? message = Deserialize(entry);
            if (message is null)
            {
                // Poison entry — acknowledge so it stops being redelivered.
                Database.StreamAcknowledge(configuration.Stream, configuration.ConsumerGroup, entry.Id);
                continue;
            }

            yield return new IngestEnvelope(entry.Id.ToString(), message);
        }
    }

    private IngestMessage? Deserialize(StreamEntry entry)
    {
        try
        {
            RedisValue payload = entry[PayloadField];
            var payloadString = payload.ToString();
            return string.IsNullOrWhiteSpace(payloadString)
                ? null 
                : JsonSerializer.Deserialize<IngestMessage>(payloadString);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Discarding unparseable ingestion entry {MessageId}", entry.Id);
            return null;
        }
    }

    // Called at the start of every consume loop (including retries after a Redis blip) so the
    // group is recreated if a restarted Redis lost it.
    private async Task EnsureGroupAsync()
    {
        try
        {
            await Database.StreamCreateConsumerGroupAsync(
                configuration.Stream,
                configuration.ConsumerGroup,
                StreamPosition.Beginning,
                createStream: true);
        }
        catch (RedisServerException ex) when (ex.Message.Contains("BUSYGROUP"))
        {
            // Consumer group already exists — fine.
        }
    }
}
