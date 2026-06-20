using Autofac;
using Autofac.Extensions.DependencyInjection;
using System.Text.Json.Serialization;
using Microsoft.OpenApi;
using Proxytrace.Api.Auth.Mcp;
using Proxytrace.Api.Kiosk;
using Proxytrace.Api.Middleware;
using Proxytrace.Application.Demo;
using Module = Proxytrace.Api.Module;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseServiceProviderFactory(new AutofacServiceProviderFactory());
builder.Host.ConfigureContainer<ContainerBuilder>(containerBuilder =>
    containerBuilder.RegisterModule<Module>());

// The MCP server is hosted only outside kiosk mode (kiosk has no accounts/API keys and its
// read-only middleware 403s the POST anyway). Matches the registration guard in Module.cs.
var kioskEnabled = builder.Configuration.GetSection("Kiosk").Get<KioskOptions>()?.Enabled ?? false;

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy
            .WithOrigins(builder.Configuration["Frontend:AllowedOrigin"] ?? "http://localhost:4201")
            .AllowAnyMethod()
            .AllowAnyHeader());
});

builder.Services.AddHttpContextAccessor();

builder.Services.AddAuthorization(options =>
{
    // The MCP endpoint authenticates only via the McpApiKey scheme: a browser JWT/cookie must not
    // reach it, and an MCP API key is not valid for the rest of the API.
    if (!kioskEnabled)
    {
        options.AddPolicy("Mcp", policy => policy
            .AddAuthenticationSchemes(McpApiKeyAuthenticationHandler.SchemeName)
            .RequireAuthenticatedUser());
    }
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

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Proxytrace API v1"));
}

app.UseCors("Frontend");
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseMiddleware<KioskReadOnlyMiddleware>();
app.UseAuthentication();
app.UseAuthorization();
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