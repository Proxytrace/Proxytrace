using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Auth;
using Proxytrace.Api.Dto.Auth;
using Proxytrace.Application.Auth;
using Proxytrace.Application.Auth.Local;
using Proxytrace.Application.Setup;
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
        IConfiguration config)
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
        if (result is null) return Unauthorized();
        SessionCookie.Append(Response, result.Token, result.ExpiresAt);
        return new TokenResponse(result.Token, result.ExpiresAt);
    }

    // The session rides in an httpOnly cookie (see SessionCookie), so the SPA cannot read
    // or clear it itself — logout clears it server-side. Anonymous and idempotent.
    [HttpPost("logout")]
    [AllowAnonymous]
    [RequireLocalMode]
    public IActionResult Logout()
    {
        SessionCookie.Delete(Response);
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
        return new MeDto(me.Id, me.Email, me.Role, me.Language);
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
        var removed = await inviteRepo.RemoveAsync(id, ct);
        return removed ? NoContent() : NotFound();
    }
}
