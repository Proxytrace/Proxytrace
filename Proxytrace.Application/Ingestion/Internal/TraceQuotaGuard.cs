using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Proxytrace.Common.Time;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Licensing;

namespace Proxytrace.Application.Ingestion.Internal;

/// <summary>
/// Periodically recomputes whether the current calendar month's trace count has exceeded the
/// licensed <see cref="LicenseLimit.MaxTracesPerMonth"/> cap. Ingestion reads the cached flag to
/// decide whether to drop incoming traces, avoiding a database count on every captured call.
/// </summary>
internal sealed class TraceQuotaGuard : BackgroundService, ITraceQuotaGuard
{
    private static readonly TimeSpan RecomputeInterval = TimeSpan.FromMinutes(5);

    private readonly IAgentCallRepository agentCalls;
    private readonly ILicenseService licenseService;
    private readonly IClock clock;
    private readonly ILogger<TraceQuotaGuard> logger;

    private volatile bool overQuota;

    public TraceQuotaGuard(
        IAgentCallRepository agentCalls,
        ILicenseService licenseService,
        IClock clock,
        ILogger<TraceQuotaGuard> logger)
    {
        this.agentCalls = agentCalls;
        this.licenseService = licenseService;
        this.clock = clock;
        this.logger = logger;
    }

    public bool IsCurrentMonthOverQuota => overQuota;

    protected override async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        await RecomputeAsync(cancellationToken);

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(RecomputeInterval, cancellationToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }

            await RecomputeAsync(cancellationToken);
        }
    }

    private async Task RecomputeAsync(CancellationToken cancellationToken)
    {
        try
        {
            var limit = licenseService.GetLimit(LicenseLimit.MaxTracesPerMonth);
            if (limit == long.MaxValue)
            {
                overQuota = false;
                return;
            }

            var now = clock.UtcNow;
            var monthStart = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);

            var (_, total) = await agentCalls.GetFilteredAsync(
                new AgentCallFilter(From: monthStart),
                page: 1,
                pageSize: 1,
                cancellationToken);

            var nowOverQuota = total >= limit;
            if (nowOverQuota && !overQuota)
                logger.LogWarning("Monthly trace quota reached ({Total}/{Limit}); dropping further traces", total, limit);

            overQuota = nowOverQuota;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Failed to recompute trace quota");
        }
    }
}
