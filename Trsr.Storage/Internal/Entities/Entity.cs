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
        foreach (var __r in Validation.NotDefault(Id, nameof(Id)).AsEnumerable()) yield return __r;
        foreach (var __r in Validation.NotDefault(CreatedAt, nameof(CreatedAt)).AsEnumerable()) yield return __r;
        foreach (var __r in Validation.InPast(CreatedAt, nameof(CreatedAt)).AsEnumerable()) yield return __r;
        foreach (var __r in Validation.NotDefault(UpdatedAt, nameof(UpdatedAt)).AsEnumerable()) yield return __r;
        foreach (var __r in Validation.InPast(UpdatedAt, nameof(UpdatedAt)).AsEnumerable()) yield return __r;
    }
}