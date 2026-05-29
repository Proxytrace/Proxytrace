using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;

namespace Proxytrace.Api.Auth;

internal static class JwtBearerEventsFactory
{
    public static JwtBearerEvents Create() => new()
    {
        OnMessageReceived = context =>
        {
            if (string.IsNullOrEmpty(context.Token))
            {
                var queryToken = context.Request.Query["access_token"].ToString();
                if (!string.IsNullOrEmpty(queryToken))
                {
                    context.Token = queryToken;
                }
            }

            return Task.CompletedTask;
        },
        OnTokenValidated = async context =>
        {
            var principal = context.Principal;
            if (principal is null)
            {
                context.Fail("Missing principal.");
                return;
            }

            var resolver = context.HttpContext.RequestServices.GetRequiredService<IAuthUserResolver>();
            var user = await resolver.Resolve(context, principal);
            if (user is null)
            {
                return;
            }

            context.HttpContext.Items[CurrentUserAccessor.UserIdItemKey] = user.Id;

            var identity = (ClaimsIdentity?)principal.Identity;
            if (identity != null && !identity.HasClaim(c => c.Type == ClaimTypes.Role))
            {
                identity.AddClaim(new Claim(ClaimTypes.Role, user.Role.ToString()));
            }
        },
    };
}
