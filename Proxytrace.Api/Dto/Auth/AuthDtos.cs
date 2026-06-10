using Proxytrace.Domain.User;

namespace Proxytrace.Api.Dto.Auth;

public record AuthModeDto(string Mode, bool SetupRequired, bool LegacyClaimAvailable);
public record LoginRequest(string Email, string Password);
public record ClaimLegacyRequest(string Email, string Password);
public record SignupRequest(string Token, string Password);
public record SetupAdminRequest(string Email, string Password);
public record TokenResponse(string Token, DateTimeOffset ExpiresAt);
public record StreamTicketResponse(string Token, DateTimeOffset ExpiresAt);
public record CreateInviteRequest(string Email, UserRole Role);
public record InviteDto(Guid Id, string Email, UserRole Role, DateTimeOffset ExpiresAt, DateTimeOffset? ConsumedAt, string Url);
public record CreateInviteResponse(string Token, string Url, DateTimeOffset ExpiresAt);
public record InvitePreviewDto(string Email, UserRole Role, DateTimeOffset ExpiresAt);
