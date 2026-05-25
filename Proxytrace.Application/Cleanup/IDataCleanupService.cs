namespace Proxytrace.Application.Cleanup;

public interface IDataCleanupService
{
    Task DeleteAllNonModelDataAsync(CancellationToken cancellationToken = default);
}
