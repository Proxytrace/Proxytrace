using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Proxytrace.Storage.Internal;

/// <summary>
/// Abstract base class for entity configurations.
/// </summary>
internal abstract class AbstractEntityConfiguration<TEntity> :
    IEntityTypeConfiguration<TEntity>, 
    IModelConfiguration
    where TEntity : class
{
    /// <inheritdoc />
    public abstract void Configure(EntityTypeBuilder<TEntity> builder);

    /// <inheritdoc />
    public void CreateModel(ModelBuilder builder) 
        => builder.ApplyConfiguration(this);
}