using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Proxytrace.Common.Async;
using Proxytrace.Domain;
using Proxytrace.Domain.Model;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Storage.Internal.Entities.Model;
using Proxytrace.Storage.Internal.Entities.ModelProvider;

namespace Proxytrace.Storage.Internal.Entities.ModelEndpoint;

internal class ModelEndpointConfig : AbstractEntityConfiguration<ModelEndpointEntity>, IMapper<IModelEndpoint, ModelEndpointEntity>
{
    private readonly IModelEndpoint.CreateExisting factory;
    private readonly IRepository<IModel> models;
    private readonly IRepository<IModelProvider> providers;

    public ModelEndpointConfig(
        IModelEndpoint.CreateExisting factory,
        IRepository<IModel> models,
        IRepository<IModelProvider> providers)
    {
        this.factory = factory;
        this.models = models;
        this.providers = providers;
    }

    public override void Configure(EntityTypeBuilder<ModelEndpointEntity> builder)
    {
        builder.Property(e => e.InputTokenCost).HasPrecision(18, 6).IsRequired(false);
        builder.Property(e => e.OutputTokenCost).HasPrecision(18, 6).IsRequired(false);

        builder
            .HasOne<ModelEntity>()
            .WithMany()
            .HasForeignKey(e => e.Model)
            .OnDelete(DeleteBehavior.Restrict);

        builder
            .HasOne<ModelProviderEntity>()
            .WithMany()
            .HasForeignKey(e => e.Provider)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => new { e.Model, e.Provider }).IsUnique();
    }

    public async Task<IModelEndpoint> Map(ModelEndpointEntity stored, CancellationToken cancellationToken = default)
    {
        var model = await models.GetAsync(stored.Model, cancellationToken);
        var provider = await providers.GetAsync(stored.Provider, cancellationToken);
        return factory(model, provider, stored.InputTokenCost, stored.OutputTokenCost, stored);
    }

    public Task<ModelEndpointEntity> Map(IModelEndpoint domain, CancellationToken cancellationToken = default)
        => new ModelEndpointEntity
        {
            Id = domain.Id,
            Model = domain.Model.Id,
            Provider = domain.Provider.Id,
            InputTokenCost = domain.InputTokenCost,
            OutputTokenCost = domain.OutputTokenCost,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}

