using System.ComponentModel.DataAnnotations;

namespace Proxytrace.Domain;

/// <summary>
/// Base interface for all domain objects; requires <see cref="IValidatableObject"/> validation support.
/// </summary>
public interface IDomainObject : IValidatableObject
{
}