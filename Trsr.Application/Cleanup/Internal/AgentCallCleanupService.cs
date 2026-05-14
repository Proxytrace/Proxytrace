using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Trsr.Domain.AgentCall;

namespace Trsr.Application.Cleanup.Internal;

internal sealed class AgentCallCleanupService : BackgroundService
{
    private readonly AgentCallCleanupConfiguration configuration;
    private readonly ILogger<AgentCallCleanupService> logger;
    private readonly IAgentCallRepository agentCallRepository;

    private readonly TimeSpan retentionDuration;

    public AgentCallCleanupService(
        AgentCallCleanupConfiguration configuration,
        ILogger<AgentCallCleanupService> logger,
        IAgentCallRepository agentCallRepository)
    {
        this.configuration = configuration;
        this.logger = logger;
        this.agentCallRepository = agentCallRepository;

        if (configuration.RetentionDurationDays <= 0)
        {
            throw new ArgumentException("RetentionDurationDays must be greater than zero");
        }

        retentionDuration = TimeSpan.FromDays(configuration.RetentionDurationDays);
    }

    public async Task CleanOnceAsync(CancellationToken cancellationToken)
    {
        try
        {
            var cutoffDate = DateTimeOffset.UtcNow - retentionDuration;
            var numRemoved = await agentCallRepository.RemoveOlderThanAsync(cutoffDate, cancellationToken);

            logger.LogInformation("Removed {numRemoved} AgentCalls older than {retentionDuration} days", numRemoved,
                retentionDuration.TotalDays);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Removing AgentCall failed");
        }
    }

    protected override async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        var period = TimeSpan.FromHours(Math.Max(1, configuration.CleanupIntervalHours));
        while (!cancellationToken.IsCancellationRequested)
        {
            await CleanOnceAsync(cancellationToken);

            try
            {
                await Task.Delay(period, cancellationToken);
            }
            catch (TaskCanceledException)
            {
                return;
            }
        }
    }
}