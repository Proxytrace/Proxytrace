namespace Trsr.Domain.Search;

/// <summary>
/// In-memory tracker of which projects are currently being reindexed.
/// </summary>
public interface IReindexStateTracker
{
    bool IsReindexing(Guid projectId);
    IDisposable BeginReindex(Guid projectId);
}
