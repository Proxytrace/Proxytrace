using System.Text.Json;
using Proxytrace.Application.Demo;

namespace Proxytrace.Api.Kiosk;

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
    private readonly KioskEndpointOptions endpoint;

    public KioskReadOnlyMiddleware(RequestDelegate next, KioskOptions options, KioskEndpointOptions endpoint)
    {
        this.next = next;
        this.options = options;
        this.endpoint = endpoint;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!options.Enabled)
        {
            await next(context);
            return;
        }
        
        var method = context.Request.Method;
        if (!ReadMethods.Contains(method) && !IsAllowedWrite(context.Request))
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

    // Tracey chat is the one interactive write permitted in kiosk: it forwards to the configured
    // demo LLM endpoint. Only allow it when that endpoint exists; otherwise the demo stays read-only.
    private bool IsAllowedWrite(HttpRequest request)
        => endpoint.IsConfigured
           && request.Path.StartsWithSegments("/api/tracey", StringComparison.OrdinalIgnoreCase);
}
