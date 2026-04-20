using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Common.Serialization;
using Trsr.Domain;
using Trsr.Domain.Organization;
using Trsr.Domain.User;

namespace Trsr.Storage.Internal.Entities.Organization;

internal class OrganizationConfig : AbstractEntityConfiguration<OrganizationEntity>, IMapper<IOrganization, OrganizationEntity>
{
    private readonly IOrganization.CreateExisting factory;
    private readonly IRepository<IUser> users;
    private readonly ISerializer serializer;

    public OrganizationConfig(IOrganization.CreateExisting factory, IRepository<IUser> users, ISerializer serializer)
    {
        this.factory = factory;
        this.users = users;
        this.serializer = serializer;
    }

    public override void Configure(EntityTypeBuilder<OrganizationEntity> builder)
    {
        builder.HasIndex(e => e.Name).IsUnique();
    }

    public async Task<IOrganization> Map(OrganizationEntity stored, CancellationToken cancellationToken = default)
    {
        return factory(stored.Name, [], stored);
    }

    public Task<OrganizationEntity> Map(IOrganization domain, CancellationToken cancellationToken = default)
        => new OrganizationEntity
        {
            Id = domain.Id,
            Name = domain.Name,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}
