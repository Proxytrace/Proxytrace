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
        var payload = JsonSerializer.Serialize(message);
        await Database.StreamAddAsync(configuration.Stream, PayloadField, payload);
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
                count: 10);
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
                count: 10);

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
