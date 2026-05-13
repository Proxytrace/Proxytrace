using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Trsr.Domain;
using Trsr.Domain.User;

namespace Trsr.Api.Auth;

internal static class LocalAuthEvents
{
    public static JwtBearerEvents Create() => new()
    {
        OnMessageReceived = ctx =>
        {
            if (string.IsNullOrEmpty(ctx.Token))
            {
                var q = ctx.Request.Query["access_token"].ToString();
                if (!string.IsNullOrEmpty(q))
                {
                    ctx.Token = q;
                }
            }
            return Task.CompletedTask;
        },
        OnTokenValidated = async ctx =>
        {
            var principal = ctx.Principal;
            if (principal is null)
            {
                ctx.Fail("Missing principal."); 
                return;
            }

            var sub = principal.FindFirstValue("sub") 
                      ?? principal.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(sub, out var userId))
            {
                ctx.Fail("Invalid sub.");
                return;
            }

            var users = ctx.HttpContext.RequestServices.GetRequiredService<IRepository<IUser>>();
            var user = await users.FindAsync(userId, ctx.HttpContext.RequestAborted);
            if (user is null)
            {
                ctx.Fail("Unknown user."); 
                return;
            }

            ctx.HttpContext.Items[CurrentUserAccessor.UserIdItemKey] = user.Id;

            var id = (ClaimsIdentity?)principal.Identity;
            if (id != null && !id.HasClaim(c => c.Type == ClaimTypes.Role))
            {
                id.AddClaim(new Claim(ClaimTypes.Role, user.Role.ToString()));
            }
        }
    };
}
