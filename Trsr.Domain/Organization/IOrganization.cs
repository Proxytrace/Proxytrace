using Trsr.Domain.User;

namespace Trsr.Domain.Organization;

public interface IOrganization : IDomainEntity
{
    string Name { get; }
    IReadOnlyCollection<IUser> Users { get; }

    public delegate IOrganization CreateNew(string name, IReadOnlyCollection<IUser> users);
    public delegate IOrganization CreateExisting(string name, IReadOnlyCollection<IUser> users, IDomainEntityData existing);
}
