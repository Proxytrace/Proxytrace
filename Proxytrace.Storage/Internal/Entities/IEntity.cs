using System.ComponentModel.DataAnnotations;
using Proxytrace.Domain;

namespace Proxytrace.Storage.Internal.Entities;

/// <summary>
/// Interface for all entities. Extends <see cref="IDomainEntityData"/> so stored entities
/// can be passed directly as the <c>existing</c> argument in <c>CreateExisting</c> factory delegates.
/// </summary>
internal interface IEntity : IDomainEntityData, IValidatableObject;
