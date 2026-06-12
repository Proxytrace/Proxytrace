using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Proxytrace.Application.Auth;
using Proxytrace.Domain;
using Proxytrace.Domain.User;

namespace Proxytrace.Api.Auth;

internal static class JwtBearerEventsFactory
{
    private const string StreamTicketQueryKey = "stream_ticket";

    public static JwtBearerEvents Create() => new()
    {
        OnMessageReceived = async context =>
        {
            // SSE connections authenticate with a short-lived, single-use ticket instead of
            // the session JWT (which would leak via the EventSource query string). Redeem it
            // here and authenticate the request directly — works in both local and OIDC mode.
            var streamTicket = context.Request.Query[StreamTicketQueryKey].ToString();
            if (!string.IsNullOrEmpty(streamTicket))
            {
                await AuthenticateStreamTicket(context, streamTicket);
                return;
            }

            if (string.IsNullOrEmpty(context.Token))
            {
                var queryToken = context.Request.Query["access_token"].ToString();
                if (!string.IsNullOrEmpty(queryToken))
                {
                    context.Token = queryToken;
                }
            }

            // Browser sessions carry the JWT in the httpOnly session cookie (local mode).
            // An explicit Authorization header must win, but the handler only parses it
            // *after* this event when Token is still null — so the cookie fallback has to
            // step aside whenever a header is present, not just when Token is set.
            if (string.IsNullOrEmpty(context.Token) &&
                string.IsNullOrEmpty(context.Request.Headers.Authorization))
            {
                var cookieToken = context.Request.Cookies[SessionCookie.Name];
                if (!string.IsNullOrEmpty(cookieToken))
                {
                    context.Token = cookieToken;
                }
            }
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

    private static async Task AuthenticateStreamTicket(MessageReceivedContext context, string ticket)
    {
        var services = context.HttpContext.RequestServices;
        var userId = services.GetRequiredService<IStreamTicketService>().Consume(ticket);
        if (userId is null)
        {
            context.Fail("Invalid or expired stream ticket.");
            return;
        }

        var user = await services.GetRequiredService<IRepository<IUser>>()
            .FindAsync(userId.Value, context.HttpContext.RequestAborted);
        if (user is null)
        {
            context.Fail("Unknown user.");
            return;
        }

        context.HttpContext.Items[CurrentUserAccessor.UserIdItemKey] = user.Id;

        var identity = new ClaimsIdentity(JwtBearerDefaults.AuthenticationScheme);
        identity.AddClaim(new Claim("sub", user.Id.ToString()));
        identity.AddClaim(new Claim(ClaimTypes.Role, user.Role.ToString()));
        context.Principal = new ClaimsPrincipal(identity);
        context.Success();
    }
}
