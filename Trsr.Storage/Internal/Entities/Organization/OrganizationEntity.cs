namespace Trsr.Storage.Internal.Entities.Organization;

[StoredDomainEntity(typeof(Trsr.Domain.Organization.IOrganization))]
internal record OrganizationEntity : Entity
{
    /// <summary>
    /// <see cref="Trsr.Domain.Organization.IOrganization.Name"/>
    /// </summary>
    public required string Name { get; init; }
    
    /// <summary>
    /// Navigation property for the many-to-many relationship with users.
    /// </summary>
    public required ICollection<OrganizationUserEntity> OrganizationUsers { get; init; }
}
