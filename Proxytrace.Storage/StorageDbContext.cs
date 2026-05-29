using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
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

        if (Database.ProviderName == "Microsoft.EntityFrameworkCore.Sqlite")
        {
            ApplySqliteDateTimeOffsetConversions(modelBuilder);
        }

        if (Database.ProviderName == "Npgsql.EntityFrameworkCore.PostgreSQL")
        {
            ApplyPostgresTextColumnCompatibility(modelBuilder);
        }
    }

    // SQLite can't translate DateTimeOffset in ORDER BY, so we register a string
    // converter that keeps the same ISO 8601 TEXT format already on disk.
    private static void ApplySqliteDateTimeOffsetConversions(ModelBuilder modelBuilder)
    {
        var converter = new ValueConverter<DateTimeOffset, string>(
            v => v.ToString("o"),
            v => DateTimeOffset.Parse(v, null, DateTimeStyles.RoundtripKind));

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTimeOffset))
                {
                    property.SetValueConverter(converter);
                }
            }
        }
    }

    // The initial migrations were generated against SQLite, which stores ALL column types as TEXT.
    // PostgreSQL would default to native uuid/timestamptz types, but since the schema was created
    // with TEXT columns we must tell EF Core to use text column type plus compatible value converters
    // so that parameters and reads match what the migrations actually created.
    private static void ApplyPostgresTextColumnCompatibility(ModelBuilder modelBuilder)
    {
        var dateConverter = new ValueConverter<DateTimeOffset, string>(
            v => v.ToString("o"),
            v => DateTimeOffset.Parse(v, null, System.Globalization.DateTimeStyles.RoundtripKind));

        var nullableDateConverter = new ValueConverter<DateTimeOffset?, string?>(
            v => v == null ? null : v.Value.ToString("o"),
            v => v == null ? null : DateTimeOffset.Parse(v, null, System.Globalization.DateTimeStyles.RoundtripKind));

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(Guid) || property.ClrType == typeof(Guid?))
                {
                    property.SetColumnType("text");
                }
                else if (property.ClrType == typeof(DateTimeOffset))
                {
                    property.SetColumnType("text");
                    property.SetValueConverter(dateConverter);
                }
                else if (property.ClrType == typeof(DateTimeOffset?))
                {
                    property.SetColumnType("text");
                    property.SetValueConverter(nullableDateConverter);
                }
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