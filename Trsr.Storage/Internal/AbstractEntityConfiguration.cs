using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Storage.Internal.Entities;

namespace Trsr.Storage.Internal;

/// <summary>
/// Abstract base class for entity configurations.
/// </summary>
internal abstract class AbstractEntityConfiguration<TEntity> :
    IEntityTypeConfiguration<TEntity>, 
    IModelConfiguration
    where TEntity : class, IEntity
{
    /// <inheritdoc />
    public abstract void Configure(EntityTypeBuilder<TEntity> builder);

    /// <inheritdoc />
    public void CreateModel(ModelBuilder builder) 
        => builder.ApplyConfiguration(this);
}