using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Common.Async;
using Trsr.Domain;
using Trsr.Domain.Organization;
using Trsr.Domain.User;

namespace Trsr.Storage.Internal.Entities.Organization;

internal class OrganizationConfig : AbstractEntityConfiguration<OrganizationEntity>,
    IMapper<IOrganization, OrganizationEntity>
{
    private readonly IOrganization.CreateExisting factory;
    private readonly IRepository<IUser> users;
    private readonly Func<StorageDbContext> contextFactory;

    public OrganizationConfig(
        IOrganization.CreateExisting factory,
        IRepository<IUser> users,
        Func<StorageDbContext> contextFactory)
    {
        this.factory = factory;
        this.users = users;
        this.contextFactory = contextFactory;
    }

    /// <inheritdoc />
    public override void Configure(EntityTypeBuilder<OrganizationEntity> builder)
    {
        builder.HasIndex(e => e.Name).IsUnique();
    }

    /// <inheritdoc />
    public async Task<IOrganization> Map(OrganizationEntity stored, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var userIds = await context.Set<OrganizationUserEntity>()
            .AsNoTracking()
            .Where(ou => ou.OrganizationId == stored.Id)
            .Select(ou => ou.UserId)
            .ToListAsync(cancellationToken);

        var loadedUsers = userIds.Count > 0
            ? await users.GetManyAsync(userIds, cancellationToken)
            : [];

        return factory(stored.Name, loadedUsers, stored);
    }

    /// <inheritdoc />
    public Task<OrganizationEntity> Map(IOrganization domain, CancellationToken cancellationToken = default) 
        => new OrganizationEntity
        {
            Id = domain.Id,
            Name = domain.Name,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
            OrganizationUsers = domain.Users.Select(u => new OrganizationUserEntity
            {
                OrganizationId = domain.Id,
                UserId = u.Id
            }).ToList()
        }.ToTaskResult();
}