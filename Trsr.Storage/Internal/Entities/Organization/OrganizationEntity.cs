namespace Trsr.Storage.Internal.Entities.Organization;

[StoredDomainEntity(typeof(Trsr.Domain.Organization.IOrganization))]
internal record OrganizationEntity : Entity
{
    /// <summary>
    /// <see cref="Trsr.Domain.Organization.IOrganization.Name"/>
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// <see cref="Trsr.Domain.Organization.IOrganization.Users"/> - stored as JSON in the database
    /// </summary>
    public required IReadOnlyCollection<Guid> UserIds { get; init; }
}
