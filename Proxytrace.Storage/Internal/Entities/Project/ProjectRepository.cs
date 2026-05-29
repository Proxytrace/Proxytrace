using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Proxytrace.Common.Text;
using Proxytrace.Domain;
using Proxytrace.Domain.Events;
using Proxytrace.Domain.Exceptions;
using Proxytrace.Domain.Project;

namespace Proxytrace.Storage.Internal.Entities.Project;

[UsedImplicitly]
internal class ProjectRepository : AbstractRepository<IProject, ProjectEntity>, IProjectRepository
{
    public ProjectRepository(
        IMapper<IProject, ProjectEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents,
        AmbientDbContext ambient) : base(mapper, contextFactory, transaction, entityEvents, ambient)
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

    public async Task<IProject?> FindBySlugAsync(
        string slug,
        CancellationToken cancellationToken = default)
    {
        // Slugs are derived from the (unique) project name and not stored, so the match can't run
        // in SQL. Names are short and few, so project just the id/name pair and slugify in memory.
        var candidates = await contextFactory()
            .Set<ProjectEntity>()
            .AsNoTracking()
            .Select(p => new { p.Id, p.Name })
            .ToListAsync(cancellationToken);

        var match = candidates.FirstOrDefault(p => p.Name.ToSlug() == slug);
        return match is null ? null : await this.GetAsync(match.Id, cancellationToken);
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
