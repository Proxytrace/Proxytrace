using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Domain;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Storage.Internal.Entities.ModelEndpoint;

namespace Trsr.Storage.Internal.Entities.Project;

internal class ProjectConfig : AbstractEntityConfiguration<ProjectEntity>, IMapper<IProject, ProjectEntity>
{
    private readonly IProject.CreateExisting factory;
    private readonly IRepository<IModelEndpoint> endpoints;

    public ProjectConfig(
        IProject.CreateExisting factory,
        IRepository<IModelEndpoint> endpoints)
    {
        this.factory = factory;
        this.endpoints = endpoints;
    }

    public override void Configure(EntityTypeBuilder<ProjectEntity> builder)
    {
        builder.HasIndex(e => e.Name).IsUnique();

        builder
            .HasOne<ModelEndpointEntity>()
            .WithMany()
            .HasForeignKey(e => e.SystemEndpoint)
            .OnDelete(DeleteBehavior.Restrict);
    }

    public async Task<IProject> Map(ProjectEntity stored, CancellationToken cancellationToken = default)
    {
        IModelEndpoint endpoint = await endpoints.GetAsync(stored.SystemEndpoint, cancellationToken);
        return factory(stored.Name, endpoint, stored);
    }

    public Task<ProjectEntity> Map(IProject domain, CancellationToken cancellationToken = default)
        => new ProjectEntity
        {
            Id = domain.Id,
            Name = domain.Name,
            SystemEndpoint = domain.SystemEndpoint.Id,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}
