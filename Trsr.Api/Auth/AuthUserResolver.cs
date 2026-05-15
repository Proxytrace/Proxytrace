using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Trsr.Application.Auth;
using Trsr.Domain;
using Trsr.Domain.User;

namespace Trsr.Api.Auth;

internal interface IAuthUserResolver
{
    Task<IUser?> Resolve(TokenValidatedContext context, ClaimsPrincipal principal);
}

internal class LocalUserResolver : IAuthUserResolver
{
    public async Task<IUser?> Resolve(TokenValidatedContext context,ClaimsPrincipal principal )
    {
        var sub = principal.FindFirstValue("sub")
                  ?? principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(sub, out var userId))
        {
            context.Fail("Invalid sub.");
            return null;
        }

        var users = context.HttpContext.RequestServices.GetRequiredService<IRepository<IUser>>();
        var user = await users.FindAsync(userId, context.HttpContext.RequestAborted);
        if (user is null)
        {
            context.Fail("Unknown user.");
            return null;
        }

        return user;
    }
}

internal class JitUserResolver : IAuthUserResolver
{
    public async Task<IUser?> Resolve(TokenValidatedContext context, ClaimsPrincipal principal)
    {
        var options = context.HttpContext.RequestServices
            .GetRequiredService<IOptions<AuthOptions>>().Value;

        var issuer = principal.FindFirstValue("iss")
                     ?? principal.Claims.FirstOrDefault(c => c.Type == "iss")?.Value
                     ?? options.Oidc.Authority;
        var subject = principal.FindFirstValue(ClaimTypes.NameIdentifier)
                      ?? principal.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(subject))
        {
            context.Fail("Token has no subject claim.");
            return null;
        }

        var email = principal.FindFirstValue(options.Oidc.EmailClaimType)
                    ?? principal.FindFirstValue(ClaimTypes.Email)
                    ?? $"{subject}@unknown";

        var externalSubject = $"{issuer.TrimEnd('/')}|{subject}";

        var provisioner = context.HttpContext.RequestServices
            .GetRequiredService<IJitUserProvisioner>();

        return await provisioner.EnsureProvisionedAsync(
            externalSubject,
            email,
            context.HttpContext.RequestAborted);
    }
}