using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain;

namespace Trsr.Storage.Internal.Entities;

/// <summary>
/// Base implementation of <see cref="IEntity"/>
/// </summary>
internal abstract record Entity : IEntity
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
        foreach (var r in Validation.NotDefault(Id).AsEnumerable()) yield return r;
        foreach (var r in Validation.NotDefault(CreatedAt).AsEnumerable()) yield return r;
        foreach (var r in Validation.InPast(CreatedAt).AsEnumerable()) yield return r;
        foreach (var r in Validation.NotDefault(UpdatedAt).AsEnumerable()) yield return r;
        foreach (var r in Validation.InPast(UpdatedAt).AsEnumerable()) yield return r;
    }
}