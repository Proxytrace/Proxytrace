using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Auth;
using Trsr.Api.Dto.Auth;
using Trsr.Application.Auth;
using Trsr.Application.Auth.Local;
using Trsr.Application.Setup;
using Trsr.Domain.Invite;
using Trsr.Domain.User;

namespace Trsr.Api.Controllers;

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
        return new TokenResponse(result.Token, result.ExpiresAt);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [RequireLocalMode]
    public async Task<ActionResult<TokenResponse>> Login([FromBody] LoginRequest req, CancellationToken ct)
    {
        var result = await login.LoginAsync(req.Email, req.Password, ct);
        if (result is null) return Unauthorized();
        return new TokenResponse(result.Token, result.ExpiresAt);
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

        var session = await login.LoginAsync(user.Email, req.Password, ct);
        return new TokenResponse(session!.Token, session.ExpiresAt);
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
        var baseUrl = config["Frontend:BaseUrl"] ?? $"{Request.Scheme}://{Request.Host}";
        var url = $"{baseUrl.TrimEnd('/')}/signup?token={Uri.EscapeDataString(invite.Token)}";
        return new CreateInviteResponse(invite.Token, url, invite.ExpiresAt);
    }

    [Authorize(Roles = nameof(UserRole.Admin))]
    [RequireLocalMode]
    [HttpGet("invites")]
    public async Task<IReadOnlyList<InviteDto>> List(CancellationToken ct)
    {
        var all = await inviteRepo.GetAllAsync(ct);
        return all.Select(i => new InviteDto(i.Id, i.Email, i.Role, i.ExpiresAt, i.ConsumedAt)).ToArray();
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
