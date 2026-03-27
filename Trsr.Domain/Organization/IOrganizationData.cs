namespace Trsr.Domain.Organization;

public interface IOrganizationData : IDomainEntityData
{
    public string Name { get; }
    public IReadOnlyCollection<Guid> Users { get; }
}