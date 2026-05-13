using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Trsr.Application.Auth;
using Trsr.Domain.User;

namespace Trsr.Api.Auth;

/// <summary>
/// JwtBearer events that JIT-provision a Trsr <see cref="IUser"/> from validated token claims
/// and stash the resolved user id in <c>HttpContext.Items</c> for downstream resolution.
/// </summary>
internal static class JitProvisioningEvents
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
                context.Fail("Missing token principal.");
                return;
            }

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
                return;
            }

            var email = principal.FindFirstValue(options.Oidc.EmailClaimType)
                ?? principal.FindFirstValue(ClaimTypes.Email)
                ?? $"{subject}@unknown";

            var externalSubject = $"{issuer.TrimEnd('/')}|{subject}";

            var provisioner = context.HttpContext.RequestServices
                .GetRequiredService<IJitUserProvisioner>();

            var user = await provisioner.EnsureProvisionedAsync(
                externalSubject,
                email,
                context.HttpContext.RequestAborted);

            context.HttpContext.Items[CurrentUserAccessor.UserIdItemKey] = user.Id;

            var identity = (ClaimsIdentity?)principal.Identity;
            if (identity != null && !identity.HasClaim(c => c.Type == ClaimTypes.Role))
            {
                identity.AddClaim(new Claim(ClaimTypes.Role, user.Role.ToString()));
            }
        }
    };
}
