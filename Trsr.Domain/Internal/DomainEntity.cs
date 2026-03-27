using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;

namespace Trsr.Domain.Internal;

/// <inheritdoc cref="IDomainEntity" />
internal abstract record DomainEntity : IDomainEntity
{
    /// <inheritdoc />
    public Guid Id { get; }

    /// <inheritdoc />
    public DateTimeOffset CreatedAt { get; }

    /// <inheritdoc />
    public DateTimeOffset UpdatedAt { get; }

    /// <summary>
    /// Creates a new <see cref="DomainEntity"/> instance from existing data
    /// </summary>
    protected DomainEntity(IDomainEntityData existing)
    {
        Id = existing.Id;
        CreatedAt = existing.CreatedAt;
        UpdatedAt = existing.UpdatedAt;
    }

    /// <summary>
    /// Creates a new <see cref="DomainEntity"/> instance
    /// </summary>
    protected DomainEntity()
    {
        Id = Guid.NewGuid();
        CreatedAt = DateTimeOffset.Now;
        UpdatedAt = DateTimeOffset.Now;
    }
    
    /// <inheritdoc />
    public virtual IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        yield return Validation.NotDefault(Id);
        yield return Validation.InPast(CreatedAt);
        yield return Validation.InPast(UpdatedAt);
        yield return Validation.NotBefore(UpdatedAt, CreatedAt);
    }
}