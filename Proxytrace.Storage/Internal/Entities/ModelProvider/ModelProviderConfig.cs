using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Proxytrace.Common.Async;
using Proxytrace.Domain.ModelProvider;

namespace Proxytrace.Storage.Internal.Entities.ModelProvider;

internal class ModelProviderConfig : AbstractEntityConfiguration<ModelProviderEntity>, IMapper<IModelProvider, ModelProviderEntity>
{
    private readonly IModelProvider.CreateExisting factory;

    public ModelProviderConfig(IModelProvider.CreateExisting factory)
    {
        this.factory = factory;
    }

    public override void Configure(EntityTypeBuilder<ModelProviderEntity> builder)
    {
        builder.HasIndex(e => e.Name).IsUnique();
        // Indexed for the proxy's upstream-key authentication path
        // (`IModelProviderRepository.FindByApiKeyAsync`).
        builder.HasIndex(e => e.ApiKey);
        builder.Property(e => e.Name).HasMaxLength(256).IsRequired();
        builder.Property(e => e.Endpoint).HasMaxLength(2048).IsRequired();
        builder.Property(e => e.ApiKey).HasMaxLength(512).IsRequired();
        builder.Property(e => e.Kind).IsRequired();
        builder.HasIndex(e => e.IsArchived);
    }

    public Task<IModelProvider> Map(ModelProviderEntity stored, CancellationToken cancellationToken = default)
        => factory(stored.Name, new Uri(stored.Endpoint), stored.ApiKey, stored.Kind, stored).ToTaskResult();

    public Task<ModelProviderEntity> Map(IModelProvider domain, CancellationToken cancellationToken = default)
        => new ModelProviderEntity
        {
            Id = domain.Id,
            Name = domain.Name,
            Endpoint = domain.Endpoint.ToString(),
            ApiKey = domain.ApiKey,
            Kind = domain.Kind,
            IsArchived = domain.IsArchived,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}
