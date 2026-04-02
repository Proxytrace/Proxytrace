using System.ComponentModel.DataAnnotations;

namespace Trsr.Domain;

/// <summary>
/// Base interface for all domain objects; requires <see cref="IValidatableObject"/> validation support.
/// </summary>
public interface IDomainObject : IValidatableObject
{
}