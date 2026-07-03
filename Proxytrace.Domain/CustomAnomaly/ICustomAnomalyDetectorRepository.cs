namespace Proxytrace.Domain.CustomAnomaly;

public interface ICustomAnomalyDetectorRepository : IRepository<ICustomAnomalyDetector>
{
    Task<IReadOnlyList<ICustomAnomalyDetector>> GetByProjectAsync(
        Guid projectId,
        CancellationToken cancellationToken = default);

    /// <summary>Enabled detectors of the project — the set the review pipeline evaluates per call.</summary>
    Task<IReadOnlyList<ICustomAnomalyDetector>> GetEnabledByProjectAsync(
        Guid projectId,
        CancellationToken cancellationToken = default);
}
