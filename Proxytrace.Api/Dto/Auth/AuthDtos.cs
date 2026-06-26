using Proxytrace.Domain.Notification;
using Proxytrace.Domain.User;

namespace Proxytrace.Api.Dto.Auth;

public record AuthModeDto(string Mode, bool SetupRequired, bool LegacyClaimAvailable);
public record LoginRequest(string Email, string Password);
public record ClaimLegacyRequest(string Email, string Password);
public record SignupRequest(string Token, string Password);
public record SetupAdminRequest(string Email, string Password);
public record TokenResponse(string Token, DateTimeOffset ExpiresAt);

/// <summary>
/// Login / reset-completion result. Either a session was issued (<see cref="Token"/> set,
/// <see cref="MfaRequired"/> false) or a second factor is required (<see cref="MfaRequired"/> true,
/// <see cref="MfaChallengeToken"/> set) — complete it via <c>POST /api/auth/mfa/verify</c>.
/// </summary>
public record LoginResponseDto(
    string? Token,
    DateTimeOffset? ExpiresAt,
    bool MfaRequired,
    string? MfaChallengeToken,
    DateTimeOffset? MfaChallengeExpiresAt);
public record MfaVerifyRequest(string ChallengeToken, string Code);
public record MfaActivateRequest(string Code);
public record MfaDisableRequest(string Password);
public record MfaSetupResponse(string Secret, string OtpAuthUri);
public record MfaActivateResponse(IReadOnlyList<string> BackupCodes);
public record MeDto(
    Guid Id,
    string Email,
    UserRole Role,
    string Language,
    bool EmailNotificationsEnabled,
    NotificationSeverity EmailNotificationMinSeverity,
    bool EmailEnabled,
    bool MfaEnabled);
public record StreamTicketResponse(string Token, DateTimeOffset ExpiresAt);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Token, string Password);
public record CreateInviteRequest(string Email, UserRole Role);
public record InviteDto(Guid Id, string Email, UserRole Role, DateTimeOffset ExpiresAt, DateTimeOffset? ConsumedAt);
public record CreateInviteResponse(string Token, string Url, DateTimeOffset ExpiresAt);
public record InvitePreviewDto(string Email, UserRole Role, DateTimeOffset ExpiresAt);
