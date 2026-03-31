using System.ComponentModel.DataAnnotations;
using Trsr.Domain;

namespace Trsr.Storage.Internal.Entities;

/// <summary>
/// Interface for all entities. Extends <see cref="IDomainEntityData"/> so stored entities
/// can be passed directly as the <c>existing</c> argument in <c>CreateExisting</c> factory delegates.
/// </summary>
internal interface IEntity : IDomainEntityData, IValidatableObject;
