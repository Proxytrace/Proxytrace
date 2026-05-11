using Trsr.Domain.User;

namespace Trsr.Api.Dto.Users;

public record UserDto(
    Guid Id,
    string Name,
    string Email,
    UserRole Role,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record UpdateUserRoleRequest(UserRole Role);
