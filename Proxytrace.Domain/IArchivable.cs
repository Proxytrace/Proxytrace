namespace Proxytrace.Domain;

/// <summary>
/// Opt-in marker for domain entities that support soft-delete (archive) instead of hard delete.
/// Archiving keeps the row so historical references (stored ids that are live-fetched at map time)
/// continue to resolve, while hiding the entity from list/picker queries.
/// </summary>
/// <remarks>
/// Never filter archived entities with a global query filter: by-id resolution
/// (<c>GetAsync</c>/<c>GetManyAsync</c>) must stay unfiltered so history keeps loading. Filtering
/// belongs only in list/by-collection queries (e.g. <c>GetByProjectAsync</c>, <c>GetAllAsync</c>).
/// </remarks>
public interface IArchivable : IDomainEntity;
