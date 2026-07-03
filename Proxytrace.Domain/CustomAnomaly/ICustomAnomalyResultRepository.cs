namespace Proxytrace.Domain.CustomAnomaly;

public interface ICustomAnomalyResultRepository : IRepository<ICustomAnomalyResult>
{
    /// <summary>
    /// Batch lookup for list enrichment: all results whose call is in
    /// <paramref name="agentCallIds"/>, in one query.
    /// </summary>
    Task<IReadOnlyList<ICustomAnomalyResult>> GetByAgentCallIdsAsync(
        IReadOnlyCollection<Guid> agentCallIds,
        CancellationToken cancellationToken = default);
}
