using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Metadata;
using Proxytrace.Storage.Internal;
using Proxytrace.Storage.Internal.Entities;

namespace Proxytrace.Storage;

/// <summary>
/// Database context for language model information
/// </summary>
internal class StorageDbContext : DbContext
{
    private readonly IReadOnlyCollection<IModelConfiguration> configurations;

    public StorageDbContext(
        IEnumerable<IModelConfiguration> configurations,
        DbContextOptions<StorageDbContext> options) : base(options)
    {
        this.configurations = configurations.ToArray();
    }

    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        foreach (IModelConfiguration configuration in configurations)
        {
            configuration.CreateModel(modelBuilder);
        }

        // Every persisted entity derives from Entity and carries an UpdatedAt timestamp that the
        // repositories stamp on each write. Marking it as a concurrency token makes EF emit
        // `UPDATE/DELETE ... WHERE UpdatedAt = @original` and check the affected row count, so a
        // concurrent writer that already moved the row on causes a DbUpdateConcurrencyException
        // instead of a silent lost update. This enforces optimistic concurrency at the database —
        // the in-app pre-check in AbstractRepository.UpdateCoreAsync is only a fast-fail. (The
        // in-memory provider ignores concurrency tokens, so unit tests are unaffected.)
        foreach (IMutableEntityType entityType in modelBuilder.Model.GetEntityTypes())
        {
            IMutableProperty? updatedAt = entityType.FindProperty(nameof(Entity.UpdatedAt));
            if (updatedAt is not null && updatedAt.ClrType == typeof(DateTimeOffset))
            {
                updatedAt.IsConcurrencyToken = true;
            }
        }
    }

    /// <inheritdoc />
    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        base.OnConfiguring(optionsBuilder);

        // this happens during unit tests where multiple contexts are created
        optionsBuilder.ConfigureWarnings(config => config.Ignore(CoreEventId.ManyServiceProvidersCreatedWarning));
    }
}
