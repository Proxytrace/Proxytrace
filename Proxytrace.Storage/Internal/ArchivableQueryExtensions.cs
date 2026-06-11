using System.Linq;

namespace Proxytrace.Storage.Internal;

internal static class ArchivableQueryExtensions
{
    /// <summary>
    /// Drops archived rows from a list/picker query. Apply only to list/by-collection queries —
    /// never to by-id lookups, which must keep resolving archived rows so historical references
    /// continue to load. EF translates <c>IsArchived</c> through the generic constraint by name.
    /// </summary>
    public static IQueryable<T> ExcludeArchived<T>(this IQueryable<T> query)
        where T : class, IArchivableEntity
        => query.Where(e => !e.IsArchived);
}
