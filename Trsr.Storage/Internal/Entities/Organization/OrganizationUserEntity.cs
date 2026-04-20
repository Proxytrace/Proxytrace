using Trsr.Storage.Internal.Entities.User;

namespace Trsr.Storage.Internal.Entities.Organization;

/// <summary>
/// Join table entity for the many-to-many relationship between Organizations and Users.
/// This is a storage-only entity and does not have a domain counterpart.
/// </summary>
internal record OrganizationUserEntity
{
    public required Guid OrganizationId { get; init; }
    public required Guid UserId { get; init; }
}

