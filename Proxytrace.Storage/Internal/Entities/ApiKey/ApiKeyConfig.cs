using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Proxytrace.Common.Async;
using Proxytrace.Domain;
using Proxytrace.Domain.ApiKey;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Project;
using Proxytrace.Storage.Internal.Entities.ModelProvider;
using Proxytrace.Storage.Internal.Entities.Project;

namespace Proxytrace.Storage.Internal.Entities.ApiKey;

internal class ApiKeyConfig : AbstractEntityConfiguration<ApiKeyEntity>, IMapper<IApiKey, ApiKeyEntity>
{
    private readonly IApiKey.CreateExisting factory;
    private readonly IRepository<IProject> projects;
    private readonly IRepository<IModelProvider> providers;

    public ApiKeyConfig(
        IApiKey.CreateExisting factory,
        IRepository<IProject> projects,
        IRepository<IModelProvider> providers)
    {
        this.factory = factory;
        this.projects = projects;
        this.providers = providers;
    }

    public override void Configure(EntityTypeBuilder<ApiKeyEntity> builder)
    {
        builder.HasIndex(e => e.ApiKey).IsUnique();
        builder.Property(e => e.Name).HasMaxLength(256).IsRequired();
        builder.Property(e => e.ApiKey).HasMaxLength(512).IsRequired();

        builder
            .HasOne<ProjectEntity>()
            .WithMany()
            .HasForeignKey(e => e.Project)
            .OnDelete(DeleteBehavior.Restrict);

        builder
            .HasOne<ModelProviderEntity>()
            .WithMany()
            .HasForeignKey(e => e.Provider)
            .OnDelete(DeleteBehavior.Cascade);
    }

    public async Task<IApiKey> Map(ApiKeyEntity stored, CancellationToken cancellationToken = default)
    {
        var project = await projects.GetAsync(stored.Project, cancellationToken);
        var provider = await providers.GetAsync(stored.Provider, cancellationToken);
        return factory(stored.Name, stored.ApiKey, project, provider, stored.ExpiresAt, stored);
    }

    public Task<ApiKeyEntity> Map(IApiKey domain, CancellationToken cancellationToken = default)
        => new ApiKeyEntity
        {
            Id = domain.Id,
            Name = domain.Name,
            ApiKey = domain.ApiKey,
            Project = domain.Project.Id,
            Provider = domain.Provider.Id,
            ExpiresAt = domain.ExpiresAt,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}
