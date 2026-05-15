using System.Text.Json;
using Trsr.Application.Demo;

namespace Trsr.Api.Kiosk;

internal sealed class KioskReadOnlyMiddleware
{
    private static readonly HashSet<string> ReadMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        "GET", 
        "HEAD", 
        "OPTIONS"
    };

    private readonly RequestDelegate next;
    private readonly KioskOptions options;

    public KioskReadOnlyMiddleware(RequestDelegate next, KioskOptions options)
    {
        this.next = next;
        this.options = options;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!options.Enabled)
        {
            await next(context);
            return;
        }
        
        var method = context.Request.Method;
        if (!ReadMethods.Contains(method))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json";
            var payload = JsonSerializer.Serialize(new
            {
                kiosk = true,
                code = "READ_ONLY",
                message = "Demo mode is read-only.",
            });
            await context.Response.WriteAsync(payload);
            return;
        }

        await next(context);
    }
}
