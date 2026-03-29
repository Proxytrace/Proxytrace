using Trsr.Domain.Organization;
using Trsr.Storage.Internal.Entities.User;

namespace Trsr.Storage.Internal.Entities.Organization;

[StoredDomainEntity(typeof(IOrganization))]
internal record OrganizationEntity : Entity, IOrganizationData
{
    /// <summary>
    /// <see cref="IOrganization.Name"/>
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// Navigation property for many-to-many relationship with Users
    /// </summary>
    public required IReadOnlyCollection<OrganizationUserEntity> UserEntities { get; init; } = [];
    
    /// <summary>
    /// <see cref="IOrganization.Users"/>
    /// </summary>
    public IReadOnlyCollection<Guid> Users 
        => UserEntities.Select(u => u.UserId).ToList();
}

