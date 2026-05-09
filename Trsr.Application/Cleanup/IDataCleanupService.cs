namespace Trsr.Application.Cleanup;

public interface IDataCleanupService
{
    Task DeleteAllNonModelDataAsync(CancellationToken cancellationToken = default);
}
