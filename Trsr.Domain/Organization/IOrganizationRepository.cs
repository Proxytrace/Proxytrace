namespace Trsr.Domain.Organization;

public interface IOrganizationRepository : IRepository<IOrganization>
{
    Task<IOrganization?> FindByNameAsync(string name, CancellationToken cancellationToken = default);
}
