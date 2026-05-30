namespace Proxytrace.Application.Ingestion;

/// <summary>
/// Tracks whether the current calendar month's trace ingestion has exceeded the licensed quota.
/// Ingestion consults this to drop traces once the cap is reached.
/// </summary>
public interface ITraceQuotaGuard
{
    /// <summary>
    /// True when the number of traces captured this month meets or exceeds the licensed limit.
    /// </summary>
    bool IsCurrentMonthOverQuota { get; }
}
