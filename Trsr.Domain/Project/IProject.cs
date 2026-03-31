using Trsr.Domain.Organization;

namespace Trsr.Domain.Project;

public interface IProject : IDomainEntity
{
    string Name { get; }
    IOrganization Organization { get; }

    public delegate IProject CreateNew(string name, IOrganization organization);
    public delegate IProject CreateExisting(string name, IOrganization organization, IDomainEntityData existing);
}
