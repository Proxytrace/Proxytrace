namespace Proxytrace.Storage.Internal;

/// <summary>
/// Opt-in marker for stored entities that support soft-delete (archive). The mapped
/// <see cref="IsArchived"/> column backs <c>IDomainEntityData.IsArchived</c>; only entities that
/// implement this interface get the column. See <c>IArchivable</c> for the domain-side contract.
/// </summary>
internal interface IArchivableEntity
{
    bool IsArchived { get; init; }
}
