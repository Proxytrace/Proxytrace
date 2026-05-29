using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Proxytrace.Storage.Internal;

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
    }

    /// <inheritdoc />
    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        base.OnConfiguring(optionsBuilder);

        // this happens during unit tests where multiple contexts are created
        optionsBuilder.ConfigureWarnings(config => config.Ignore(CoreEventId.ManyServiceProvidersCreatedWarning));
    }
}
