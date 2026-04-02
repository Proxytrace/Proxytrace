namespace Trsr.Api.Dto.Users;

public record UserDto(Guid Id, string Name, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

public record CreateUserRequest(string Name);

public record UpdateUserRequest(string Name);
