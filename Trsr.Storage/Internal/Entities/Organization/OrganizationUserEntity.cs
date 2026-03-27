using Microsoft.EntityFrameworkCore;

namespace Trsr.Storage.Internal.Entities.Organization;

/// <summary>
/// Junction table for the many-to-many relationship between Organization and User
/// </summary>
[PrimaryKey(nameof(OrganizationId), nameof(UserId))]
internal record OrganizationUserEntity
{
    public required Guid OrganizationId { get; init; }
    public required Guid UserId { get; init; }
}

