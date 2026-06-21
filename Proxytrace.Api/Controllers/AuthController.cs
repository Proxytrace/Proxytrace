using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Proxytrace.Api.Auth;
using Proxytrace.Api.Dto.Auth;
using Proxytrace.Application.AuditLog;
using Proxytrace.Application.Auth;
using Proxytrace.Application.Auth.Local;
using Proxytrace.Application.Notifications;
using Proxytrace.Application.Setup;
using Proxytrace.Domain.AuditLog;
using Proxytrace.Domain.Invite;
using Proxytrace.Domain.User;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AuthOptions options;
    private readonly ISetupService setup;
    private readonly ILoginService login;
    private readonly ILegacyClaimService legacyClaim;
    private readonly IInviteService invites;
    private readonly IInviteRepository inviteRepo;
    private readonly IPasswordPolicy policy;
    private readonly ICurrentUserAccessor currentUser;
    private readonly IStreamTicketService streamTickets;
    private readonly IConfiguration config;
    private readonly ILogger<Audit> audit;
    private readonly IEmailSettingsStore emailSettings;

    public AuthController(
        AuthOptions options,
        ISetupService setup,
        ILoginService login,
        ILegacyClaimService legacyClaim,
        IInviteService invites,
        IInviteRepository inviteRepo,
        IPasswordPolicy policy,
        ICurrentUserAccessor currentUser,
        IStreamTicketService streamTickets,
        IConfiguration config,
        ILogger<Audit> audit,
        IEmailSettingsStore emailSettings)
    {
        this.options = options;
        this.setup = setup;
        this.login = login;
        this.legacyClaim = legacyClaim;
        this.invites = invites;
        this.inviteRepo = inviteRepo;
        this.policy = policy;
        this.currentUser = currentUser;
        this.streamTickets = streamTickets;
        this.config = config;
        this.audit = audit;
        this.emailSettings = emailSettings;
    }

    [HttpGet("mode")]
    [AllowAnonymous]
    public async Task<AuthModeDto> GetMode(CancellationToken ct)
    {
        var isLocal = options.Mode == AuthMode.Local;
        var setupRequired = isLocal && !await setup.AnyUsersExistAsync(ct);
        var legacyClaimAvailable = isLocal && !setupRequired && await legacyClaim.IsClaimAvailableAsync(ct);
        return new AuthModeDto(isLocal ? "local" : "oidc", setupRequired, legacyClaimAvailable);
    }

    [HttpPost("claim-legacy")]
    [AllowAnonymous]
    [RequireLocalMode]
    public async Task<ActionResult<TokenResponse>> ClaimLegacy([FromBody] ClaimLegacyRequest req, CancellationToken ct)
    {
        var v = policy.Validate(req.Password);
        if (!v.IsValid) return BadRequest(v.Errors);

        var result = await legacyClaim.ClaimAsync(req.Email, req.Password, ct);
        if (result is null) return Conflict("No eligible legacy account.");
        SessionCookie.Append(Response, result.Token, result.ExpiresAt);
        audit.LogAudit(AuditAction.LegacyAccountClaimed, nameof(IUser), result.User.Id, result.User.Email);
        return new TokenResponse(result.Token, result.ExpiresAt);
    }

    [HttpPost("setup")]
    [AllowAnonymous]
    [RequireLocalMode]
    public async Task<ActionResult<TokenResponse>> Setup([FromBody] SetupAdminRequest req, CancellationToken ct)
    {
        if (await setup.AnyUsersExistAsync(ct))
            return Conflict("Setup already completed.");
        var v = policy.Validate(req.Password);
        if (!v.IsValid) return BadRequest(v.Errors);

        var result = await setup.CreateFirstAdminAsync(req.Email, req.Password, ct);
        SessionCookie.Append(Response, result.Token, result.ExpiresAt);
        audit.LogAudit(AuditAction.AdminBootstrapped, nameof(IUser), result.UserId, req.Email);
        return new TokenResponse(result.Token, result.ExpiresAt);
    }

    // Issues a short-lived, single-use token for SSE connections, so the long-lived
    // session JWT never has to ride in the EventSource query string (where it would
    // leak via browser history / Referer / proxy logs). Validate this ticket in
    // JwtBearerEventsFactory.OnMessageReceived alongside the existing access_token path.
    [HttpGet("stream-ticket")]
    [Authorize]
    public async Task<ActionResult<StreamTicketResponse>> StreamTicket(CancellationToken ct)
    {
        var me = await currentUser.GetCurrentUserAsync(ct);
        if (me is null) return Unauthorized();

        var ticket = streamTickets.Issue(me);
        return new StreamTicketResponse(ticket.Token, ticket.ExpiresAt);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [RequireLocalMode]
    public async Task<ActionResult<TokenResponse>> Login([FromBody] LoginRequest req, CancellationToken ct)
    {
        var result = await login.LoginAsync(req.Email, req.Password, ct);
        if (result is null)
        {
            // No user context on a failed login (pre-auth, anonymous) — recorded as the System actor
            // with the submitted email as the target so brute-force/credential-stuffing is visible.
            audit.LogAudit(AuditAction.LoginFailed, nameof(IUser), targetLabel: req.Email, outcome: AuditOutcome.Failure);
            return Unauthorized();
        }
        SessionCookie.Append(Response, result.Token, result.ExpiresAt);
        audit.LogAudit(AuditAction.UserLoggedIn, nameof(IUser), result.User.Id, result.User.Email);
        return new TokenResponse(result.Token, result.ExpiresAt);
    }

    // The session rides in an httpOnly cookie (see SessionCookie), so the SPA cannot read
    // or clear it itself — logout clears it server-side. Anonymous and idempotent.
    [HttpPost("logout")]
    [AllowAnonymous]
    [RequireLocalMode]
    public IActionResult Logout()
    {
        // Only audit a logout that actually ended a session — a spurious anonymous call records
        // nothing. The actor (who logged out) is enriched from the session cookie's context.
        var hadSession = Request.Cookies.ContainsKey(SessionCookie.Name);
        SessionCookie.Delete(Response);
        if (hadSession)
            audit.LogAudit(AuditAction.UserLoggedOut, nameof(IUser));
        return NoContent();
    }

    // Session restore for the SPA: identifies the caller from the httpOnly session cookie
    // (or bearer token), since the client cannot decode the cookie itself.
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<MeDto>> Me(CancellationToken ct)
    {
        var me = await currentUser.GetCurrentUserAsync(ct);
        if (me is null) return Unauthorized();
        var settings = await emailSettings.GetAsync(ct);
        return new MeDto(
            me.Id, me.Email, me.Role, me.Language,
            me.EmailNotificationsEnabled, me.EmailNotificationMinSeverity,
            EmailEnabled: settings?.Enabled ?? false);
    }

    [HttpPost("signup")]
    [AllowAnonymous]
    [RequireLocalMode]
    public async Task<ActionResult<TokenResponse>> Signup([FromBody] SignupRequest req, CancellationToken ct)
    {
        var v = policy.Validate(req.Password);
        if (!v.IsValid) return BadRequest(v.Errors);

        var user = await invites.ConsumeAsync(req.Token, req.Password, ct);
        if (user is null) return StatusCode(410, "Invite invalid, expired, or already used.");
        audit.LogAudit(AuditAction.UserSignedUp, nameof(IUser), user.Id, user.Email);

        LoginResult? session = await login.LoginAsync(user.Email, req.Password, ct);
        if (session is null) return NotFound();
        SessionCookie.Append(Response, session.Token, session.ExpiresAt);
        return new TokenResponse(session.Token, session.ExpiresAt);
    }

    [HttpGet("invites/by-token/{token}")]
    [AllowAnonymous]
    [RequireLocalMode]
    public async Task<ActionResult<InvitePreviewDto>> Preview(string token, CancellationToken ct)
    {
        var invite = await invites.GetByTokenAsync(token, ct);
        if (invite is null) return StatusCode(410);
        return new InvitePreviewDto(invite.Email, invite.Role, invite.ExpiresAt);
    }

    [Authorize(Roles = nameof(UserRole.Admin))]
    [RequireLocalMode]
    [HttpPost("invites")]
    public async Task<ActionResult<CreateInviteResponse>> Create([FromBody] CreateInviteRequest req, CancellationToken ct)
    {
        var me = await currentUser.GetCurrentUserAsync(ct);
        if (me is null) return Unauthorized();

        var invite = await invites.CreateAsync(req.Email, req.Role, me, ct);
        audit.LogAudit(
            AuditAction.UserInvited, nameof(IInvite), invite.Id, req.Email,
            details: JsonSerializer.Serialize(new { role = req.Role.ToString() }));
        return new CreateInviteResponse(invite.Token, BuildInviteUrl(invite.Token), invite.ExpiresAt);
    }

    private string BuildInviteUrl(string token)
    {
        var baseUrl = config["Frontend:BaseUrl"] ?? $"{Request.Scheme}://{Request.Host}";
        return $"{baseUrl.TrimEnd('/')}/signup?token={Uri.EscapeDataString(token)}";
    }

    [Authorize(Roles = nameof(UserRole.Admin))]
    [RequireLocalMode]
    [HttpGet("invites")]
    public async Task<IReadOnlyList<InviteDto>> List(CancellationToken ct)
    {
        var all = await inviteRepo.GetAllAsync(ct);
        return all.Select(i => new InviteDto(i.Id, i.Email, i.Role, i.ExpiresAt, i.ConsumedAt, BuildInviteUrl(i.Token))).ToArray();
    }

    [Authorize(Roles = nameof(UserRole.Admin))]
    [RequireLocalMode]
    [HttpDelete("invites/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var invite = await inviteRepo.FindAsync(id, ct);
        if (invite is null)
            return NotFound();
        if (!await inviteRepo.RemoveAsync(id, ct))
            return NotFound();
        audit.LogAudit(AuditAction.InviteRevoked, nameof(IInvite), id, invite.Email);
        return NoContent();
    }
}
