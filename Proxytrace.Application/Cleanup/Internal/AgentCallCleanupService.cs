using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Licensing;

namespace Proxytrace.Application.Cleanup.Internal;

internal sealed class AgentCallCleanupService : BackgroundService
{
    private readonly AgentCallCleanupConfiguration configuration;
    private readonly ILogger<AgentCallCleanupService> logger;
    private readonly IAgentCallRepository agentCallRepository;
    private readonly ILicenseService license;

    private readonly int configuredRetentionDays;

    public AgentCallCleanupService(
        AgentCallCleanupConfiguration configuration,
        ILogger<AgentCallCleanupService> logger,
        IAgentCallRepository agentCallRepository,
        ILicenseService license)
    {
        this.configuration = configuration;
        this.logger = logger;
        this.agentCallRepository = agentCallRepository;
        this.license = license;

        if (configuration.RetentionDurationDays <= 0)
        {
            throw new ArgumentException("RetentionDurationDays must be greater than zero");
        }

        configuredRetentionDays = configuration.RetentionDurationDays;
    }

    public async Task CleanOnceAsync(CancellationToken cancellationToken)
    {
        try
        {
            // The license can cap how long traces are retained; never retain longer than allowed.
            var cap = license.GetLimit(LicenseLimit.TraceRetentionDays);
            var effectiveDays = cap == long.MaxValue
                ? configuredRetentionDays
                : (int)Math.Min(configuredRetentionDays, cap);
            var retentionDuration = TimeSpan.FromDays(effectiveDays);
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
            try
            {
                await Task.Delay(period, cancellationToken);
            }
            catch (TaskCanceledException)
            {
                return;
            }
            
            await CleanOnceAsync(cancellationToken);
        }
    }
}