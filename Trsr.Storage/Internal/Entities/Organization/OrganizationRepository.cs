using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.Exceptions;
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
            .Include(o => o.OrganizationUsers)
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.Name == name, cancellationToken);
        return await Map(entity, cancellationToken);
    }

    /// <summary>
    /// Override UpdateAsync to properly handle the M:N relationship with EF Core change tracking
    /// </summary>
    protected override async Task UpdateRelationsAsync(
        StorageDbContext context, 
        OrganizationEntity storedEntity, 
        CancellationToken cancellationToken) 
        {
            // Load existing entity with M:N relationship tracked
            var existing = await context.Set<OrganizationEntity>()
                .Include(o => o.OrganizationUsers)
                .FirstOrDefaultAsync(o => o.Id == storedEntity.Id, cancellationToken);

            if (existing is null)
            {
                throw new EntityNotFoundException(storedEntity.Id, typeof(IOrganization));
            }

            // Sync the M:N relationship using EF Core's change tracking
            var domainUserIds = storedEntity.OrganizationUsers.Select(u => u.UserId).ToHashSet();
            var existingUserIds = existing.OrganizationUsers.Select(ou => ou.UserId).ToHashSet();

            // Remove relationships that no longer exist
            var toRemove = existing.OrganizationUsers
                .Where(ou => !domainUserIds.Contains(ou.UserId))
                .ToList();

            foreach (var item in toRemove)
            {
                context.Set<OrganizationUserEntity>().Remove(item);
            }

            // Add new relationships
            var toAdd = domainUserIds
                .Except(existingUserIds)
                .Select(userId => new OrganizationUserEntity
                {
                    OrganizationId = storedEntity.Id,
                    UserId = userId,
                });

            foreach (var item in toAdd)
            {
                context.Set<OrganizationUserEntity>().Add(item);
            }
        }
}
