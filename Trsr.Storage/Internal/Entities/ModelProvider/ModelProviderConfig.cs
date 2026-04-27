using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Domain;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Organization;
using Trsr.Storage.Internal.Entities.Organization;

namespace Trsr.Storage.Internal.Entities.ModelProvider;

internal class ModelProviderConfig : AbstractEntityConfiguration<ModelProviderEntity>, IMapper<IModelProvider, ModelProviderEntity>
{
    private readonly IModelProvider.CreateExisting factory;
    private readonly IRepository<IOrganization> organizations;

    public ModelProviderConfig(IModelProvider.CreateExisting factory, IRepository<IOrganization> organizations)
    {
        this.factory = factory;
        this.organizations = organizations;
    }

    public override void Configure(EntityTypeBuilder<ModelProviderEntity> builder)
    {
        builder.HasIndex(e => e.Name).IsUnique();
        builder.Property(e => e.Name).HasMaxLength(256).IsRequired();
        builder.Property(e => e.Endpoint).HasMaxLength(2048).IsRequired();
        builder.Property(e => e.ApiKey).HasMaxLength(512).IsRequired();

        builder
            .HasOne<OrganizationEntity>()
            .WithMany()
            .HasForeignKey(e => e.Organization)
            .OnDelete(DeleteBehavior.Restrict);
    }

    public async Task<IModelProvider> Map(ModelProviderEntity stored, CancellationToken cancellationToken = default)
    {
        var organization = await organizations.GetAsync(stored.Organization, cancellationToken);
        return factory(stored.Name, new Uri(stored.Endpoint), stored.ApiKey, organization, stored);
    }

    public Task<ModelProviderEntity> Map(IModelProvider domain, CancellationToken cancellationToken = default)
        => new ModelProviderEntity
        {
            Id = domain.Id,
            Name = domain.Name,
            Endpoint = domain.Endpoint.ToString(),
            ApiKey = domain.ApiKey,
            Organization = domain.Organization.Id,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}
