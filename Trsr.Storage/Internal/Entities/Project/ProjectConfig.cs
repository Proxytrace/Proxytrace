using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Domain.Project;

namespace Trsr.Storage.Internal.Entities.Project;

internal class ProjectConfig : AbstractEntityConfiguration<ProjectEntity>, IMapper<IProject, ProjectEntity>
{
    private readonly IProject.CreateExisting factory;

    public ProjectConfig(IProject.CreateExisting factory)
    {
        this.factory = factory;
    }

    public override void Configure(EntityTypeBuilder<ProjectEntity> builder)
    {
        builder.HasIndex(e => e.Name).IsUnique();
    }

    public Task<IProject> Map(ProjectEntity stored, CancellationToken cancellationToken = default)
        => Task.FromResult(factory(stored.Name, stored));

    public Task<ProjectEntity> Map(IProject domain, CancellationToken cancellationToken = default)
        => new ProjectEntity
        {
            Id = domain.Id,
            Name = domain.Name,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}
