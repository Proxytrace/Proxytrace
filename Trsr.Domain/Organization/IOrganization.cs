namespace Trsr.Domain.Organization;

public interface IOrganization : IDomainEntity, IOrganizationData
{
    public delegate IOrganization CreateNew(string name, IReadOnlyCollection<Guid> users);
    public delegate IOrganization CreateExisting(IOrganizationData existing);
}