namespace Proxytrace.Domain;

/// <summary>
/// Repository for an <see cref="IArchivable"/> entity that soft-deletes (archives) instead of
/// hard-deleting. List/by-collection queries on implementations exclude archived rows; by-id
/// lookups stay unfiltered so historical references keep resolving.
/// </summary>
public interface IArchivableRepository<T> : IRepository<T> where T : class, IArchivable
{
    /// <summary>
    /// Archives the entity with the given <paramref name="id"/> (idempotent). Returns
    /// <c>false</c> if no such entity exists, <c>true</c> otherwise.
    /// </summary>
    Task<bool> ArchiveAsync(Guid id, CancellationToken cancellationToken = default);
}
