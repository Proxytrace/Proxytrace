using Trsr.Domain.User;

namespace Trsr.Application.Auth;

/// <summary>
/// Resolves the <see cref="IUser"/> for the current HTTP request.
/// Implemented in the API layer (depends on HttpContext).
/// </summary>
public interface ICurrentUserAccessor
{
    /// <summary>
    /// Returns the user associated with the current request, or <see langword="null"/>
    /// when called outside of an authenticated request scope.
    /// </summary>
    Task<IUser?> GetCurrentUserAsync(CancellationToken cancellationToken = default);
}
