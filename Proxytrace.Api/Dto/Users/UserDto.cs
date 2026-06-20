using Proxytrace.Domain.User;

namespace Proxytrace.Api.Dto.Users;

public record UserDto(
    Guid Id,
    string Email,
    UserRole Role,
    bool IsExternal,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record UpdateUserRoleRequest(UserRole Role);

/// <summary>Self-service UI language change for the current user (BCP-47 culture code).</summary>
public record UpdateMyLanguageRequest(string Language);

/// <summary>Lightweight project reference for the user-centric project assignment editor.</summary>
public record UserProjectDto(Guid Id, string Name);
