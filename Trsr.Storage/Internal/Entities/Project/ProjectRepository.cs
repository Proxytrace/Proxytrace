using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.Events;
using Trsr.Domain.Exceptions;
using Trsr.Domain.Project;

namespace Trsr.Storage.Internal.Entities.Project;

[UsedImplicitly]
internal class ProjectRepository : AbstractRepository<IProject, ProjectEntity>, IProjectRepository
{
    public ProjectRepository(
        IMapper<IProject, ProjectEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents) : base(mapper, contextFactory, transaction, entityEvents)
    {
    }

    public async Task<IProject?> FindByNameAsync(
        string name,
        CancellationToken cancellationToken = default)
    {
        var entity = await contextFactory()
            .Set<ProjectEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Name == name, cancellationToken);
        return await Map(entity, cancellationToken);
    }

    protected override async Task UpdateRelationsAsync(
        StorageDbContext context,
        ProjectEntity storedEntity,
        CancellationToken cancellationToken)
    {
        var existing = await context.Set<ProjectEntity>()
            .Include(p => p.ProjectUsers)
            .FirstOrDefaultAsync(p => p.Id == storedEntity.Id, cancellationToken);

        if (existing is null)
            throw new EntityNotFoundException(storedEntity.Id, typeof(IProject));

        var newIds = storedEntity.ProjectUsers.Select(j => j.UserId).ToHashSet();
        var existingIds = existing.ProjectUsers.Select(j => j.UserId).ToHashSet();

        var toRemove = existing.ProjectUsers.Where(j => !newIds.Contains(j.UserId)).ToList();
        foreach (var item in toRemove)
            context.Set<ProjectUserEntity>().Remove(item);

        var toAdd = newIds.Except(existingIds)
            .Select(id => new ProjectUserEntity { ProjectId = storedEntity.Id, UserId = id });
        foreach (var item in toAdd)
            context.Set<ProjectUserEntity>().Add(item);
    }
}
