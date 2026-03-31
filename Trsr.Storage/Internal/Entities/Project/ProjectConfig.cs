using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Domain;
using Trsr.Domain.Organization;
using Trsr.Domain.Project;
using Trsr.Storage.Internal.Entities.Organization;

namespace Trsr.Storage.Internal.Entities.Project;

internal class ProjectConfig : AbstractEntityConfiguration<ProjectEntity>, IMapper<IProject, ProjectEntity>
{
    private readonly IProject.CreateExisting factory;
    private readonly IRepository<IOrganization> organizations;

    public ProjectConfig(IProject.CreateExisting factory, IRepository<IOrganization> organizations)
    {
        this.factory = factory;
        this.organizations = organizations;
    }

    public override void Configure(EntityTypeBuilder<ProjectEntity> builder)
    {
        builder.HasIndex(e => new { e.Name, e.Organization }).IsUnique();

        builder
            .HasOne<OrganizationEntity>()
            .WithMany()
            .HasForeignKey(e => e.Organization)
            .OnDelete(DeleteBehavior.Restrict);
    }

    public async Task<IProject> Map(ProjectEntity stored, CancellationToken cancellationToken = default)
    {
        var organization = await organizations.GetAsync(stored.Organization, cancellationToken);
        return factory(stored.Name, organization, stored);
    }

    public Task<ProjectEntity> Map(IProject domain, CancellationToken cancellationToken = default)
        => new ProjectEntity
        {
            Id = domain.Id,
            Name = domain.Name,
            Organization = domain.Organization.Id,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}
