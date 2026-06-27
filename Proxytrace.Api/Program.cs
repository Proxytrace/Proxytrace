using Autofac;
using Autofac.Extensions.DependencyInjection;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.OpenApi;
using Proxytrace.Api.Auth.Mcp;
using Proxytrace.Api.Kiosk;
using Proxytrace.Api.Middleware;
using Proxytrace.Domain.Kiosk;
using Module = Proxytrace.Api.Module;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseServiceProviderFactory(new AutofacServiceProviderFactory());
builder.Host.ConfigureContainer<ContainerBuilder>(containerBuilder =>
    containerBuilder.RegisterModule<Module>());

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy
            .WithOrigins(builder.Configuration["Frontend:AllowedOrigin"] ?? "http://localhost:4201")
            .AllowAnyMethod()
            .AllowAnyHeader());
});

builder.Services.AddHttpContextAccessor();

// Throttle the anonymous password-reset endpoints (forgot/reset) per client IP to blunt account
// enumeration and brute-forcing of reset tokens. In-memory is fine — each deployment runs a single
// API instance. Applied via [EnableRateLimiting("auth-reset")] on the endpoints.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth-reset", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0,
            }));

    // The MFA verify endpoint validates a 6-digit code — a small space — so it is rate-limited per
    // client IP (in addition to the per-challenge attempt cap) to blunt brute force.
    options.AddPolicy("auth-mfa", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0,
            }));
});

builder.Services.AddAuthorization(options =>
{
    // The MCP endpoint authenticates only via the McpApiKey scheme: a browser JWT/cookie must not
    // reach it, and an MCP API key is not valid for the rest of the API. The policy is harmless when
    // unused — it is only ever evaluated if the /mcp endpoint is mapped (non-kiosk).
    options.AddPolicy("Mcp", policy => policy
        .AddAuthenticationSchemes(McpApiKeyAuthenticationHandler.SchemeName)
        .RequireAuthenticatedUser());
});

builder.Services.AddControllers(options =>
        options.Filters.Add<Proxytrace.Api.Auth.Licensing.LicenseEnforcementFilter>())
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new OpenApiInfo { Title = "Proxytrace API", Version = "v1" });
        c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Name = "Authorization",
            In = ParameterLocation.Header,
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            Description = "Enter the token below, without any prefixes",
        });
        c.AddSecurityRequirement(doc => new OpenApiSecurityRequirement
        {
            [new OpenApiSecuritySchemeReference("Bearer", doc)] = [],
        });
    });
}

#if DEBUG
// DEBUG-ONLY developer back-door: seed a fixed admin (debug@proxytrace.dev) so a local debug build
// can always sign in through the normal login form. Compiled out of Release entirely — both this
// registration and the seeder type are under #if DEBUG. See Proxytrace.Api/Debug + docs/debug_api.md.
builder.Services.AddHostedService<Proxytrace.Api.Debug.DebugLoginSeederHostedService>();
#endif

var app = builder.Build();

// Resolve the kiosk decision from the container (the Module is the single source of truth — it reads
// appsettings.local.json, which builder.Configuration does not). Re-reading config here would diverge.
var kioskEnabled = app.Services.GetRequiredService<KioskOptions>().Enabled;

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Proxytrace API v1"));
}

app.UseCors("Frontend");
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseMiddleware<KioskReadOnlyMiddleware>();
// Before UseAuthorization so it still runs when an authorization failure short-circuits with 403.
app.UseMiddleware<AuditDeniedAccessMiddleware>();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapControllers();

// MCP server (Streamable HTTP, stateless). Authenticated per-request by an API key whose project
// scopes the call (see McpApiKeyAuthenticationHandler + IMcpProjectAccessor). Omitted in kiosk.
if (!kioskEnabled)
{
    app.MapMcp("/mcp").RequireAuthorization("Mcp");
}
// The bundled VitePress manual lives under wwwroot/docs. Existing files (e.g.
// /docs/guide/x.html) are served by the static middleware above. A bare directory
// request like /docs or /docs/ has no file to match and UseDefaultFiles is skipped
// once an endpoint is selected, so route any unmatched /docs path to the manual's
// index instead of letting it fall through to the SPA fallback below.
app.MapFallbackToFile("/docs/{*path}", "docs/index.html");
app.MapFallbackToFile("index.html");

app.Run();