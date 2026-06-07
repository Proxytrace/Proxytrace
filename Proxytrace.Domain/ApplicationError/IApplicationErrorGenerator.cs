namespace Proxytrace.Domain.ApplicationError;

/// <summary>
/// Generator for <see cref="IApplicationError"/> test data, with an overload that persists an
/// entry at a specific <c>CreatedAt</c> (used to exercise rotation/retention).
/// </summary>
public interface IApplicationErrorGenerator : IDomainEntityGenerator<IApplicationError>
{
    Task<IApplicationError> CreateAsync(DateTimeOffset createdAt, CancellationToken cancellationToken = default);
}
