using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Domain.ModelProvider;

namespace Trsr.Storage.Internal.Entities.ModelProvider;

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
        builder.Property(e => e.Name).HasMaxLength(256).IsRequired();
        builder.Property(e => e.Endpoint).HasMaxLength(2048).IsRequired();
        builder.Property(e => e.ApiKey).HasMaxLength(512).IsRequired();
        builder.Property(e => e.Kind).IsRequired();
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
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}
