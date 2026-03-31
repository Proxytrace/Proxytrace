using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain;

namespace Trsr.Storage.Internal.Entities;

/// <summary>
/// Base implementation of <see cref="IEntity"/>
/// </summary>
internal abstract record Entity : IEntity, IDomainEntityData
{
    /// <inheritdoc cref="IDomainEntityData" />
    public required Guid Id { get; init; }

    /// <inheritdoc cref="IDomainEntityData" />
    public required DateTimeOffset CreatedAt { get; init; }

    /// <inheritdoc cref="IDomainEntityData"     />
    public required DateTimeOffset UpdatedAt { get; init; }

    /// <inheritdoc />
    public virtual IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        yield return Validation.NotDefault(Id, nameof(Id));
        yield return Validation.NotDefault(CreatedAt, nameof(CreatedAt));
        yield return Validation.InPast(CreatedAt, nameof(CreatedAt));
        yield return Validation.NotDefault(UpdatedAt, nameof(UpdatedAt));
        yield return Validation.InPast(UpdatedAt, nameof(UpdatedAt));
    }
}