using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.Organization;

namespace Trsr.Storage.Internal.Entities.Organization;

[UsedImplicitly]
internal class OrganizationRepository : AbstractRepository<IOrganization, OrganizationEntity>, IOrganizationRepository
{
    public OrganizationRepository(
        IMapper<IOrganization, OrganizationEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction) : base(mapper, contextFactory, transaction)
    {
    }

    public async Task<IOrganization?> FindByNameAsync(string name, CancellationToken cancellationToken = default)
    {
        var entity = await contextFactory()
            .Set<OrganizationEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.Name == name, cancellationToken);
        return await Map(entity, cancellationToken);
    }
}
