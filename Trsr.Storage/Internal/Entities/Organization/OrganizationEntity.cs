namespace Trsr.Storage.Internal.Entities.Organization;

[StoredDomainEntity(typeof(Trsr.Domain.Organization.IOrganization))]
internal record OrganizationEntity : Entity
{
    /// <summary>
    /// <see cref="Trsr.Domain.Organization.IOrganization.Name"/>
    /// </summary>
    public required string Name { get; init; }
}
