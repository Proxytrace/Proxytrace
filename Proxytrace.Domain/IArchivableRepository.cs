namespace Proxytrace.Domain;

/// <summary>
/// Repository for an <see cref="IArchivable"/> entity that soft-deletes (archives) instead of
/// hard-deleting. List/by-collection queries on implementations exclude archived rows; by-id
/// lookups stay unfiltered so historical references keep resolving.
/// </summary>
public interface IArchivableRepository<T> : IRepository<T> where T : class, IArchivable
{
    /// <summary>
    /// Archives the entity with the given <paramref name="id"/>. Returns <c>true</c> only when this
    /// call actually transitioned a live row to archived; returns <c>false</c> when no such entity
    /// exists <em>or</em> it was already archived (a no-op). Callers can therefore treat a repeated
    /// delete as "nothing changed" — e.g. return 404 and skip auditing.
    /// </summary>
    Task<bool> ArchiveAsync(Guid id, CancellationToken cancellationToken = default);
}
