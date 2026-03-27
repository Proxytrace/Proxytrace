using JetBrains.Annotations;
using Trsr.Domain;
using Trsr.Domain.Organization;

namespace Trsr.Storage.Internal.Entities.Organization;

[UsedImplicitly]
internal class OrganizationRepository : AbstractRepository<IOrganization, OrganizationEntity>
{
    public OrganizationRepository(
        IMapper<IOrganization, OrganizationEntity> mapper, 
        Func<StorageDbContext> contextFactory, 
        ITransaction transaction) : base(mapper, contextFactory, transaction)
    {
    }
}