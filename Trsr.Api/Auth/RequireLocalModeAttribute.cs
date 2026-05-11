using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Trsr.Api.Auth;

internal sealed class RequireLocalModeAttribute : Attribute, IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext ctx)
    {
        var opts = ctx.HttpContext.RequestServices.GetRequiredService<AuthOptions>();
        if (opts.Mode != AuthMode.Local)
        {
            ctx.Result = new NotFoundResult();
        }
    }
}
