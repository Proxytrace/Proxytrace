namespace Trsr.Api.Dto.Organizations;

public record OrganizationDto(
    Guid Id,
    string Name,
    IReadOnlyList<Guid> UserIds,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record CreateOrganizationRequest(string Name, IReadOnlyList<Guid> UserIds);

public record UpdateOrganizationRequest(string Name, IReadOnlyList<Guid> UserIds);
