using Trsr.Domain.Organization;

namespace Trsr.Domain.Project;

public interface IProjectRepository : IRepository<IProject>
{
    Task<IProject?> FindByNameAsync(string name, IOrganization organization, CancellationToken cancellationToken = default);
}
