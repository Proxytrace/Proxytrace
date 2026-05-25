using Proxytrace.Domain.User;

namespace Proxytrace.Api.Dto.Users;

public record UserDto(
    Guid Id,
    string Email,
    UserRole Role,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record UpdateUserRoleRequest(UserRole Role);
