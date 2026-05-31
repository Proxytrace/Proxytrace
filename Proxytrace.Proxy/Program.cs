using System.Text.Json;
using System.Text.Json.Serialization;
using Autofac;
using Autofac.Extensions.DependencyInjection;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseServiceProviderFactory(new AutofacServiceProviderFactory());
builder.Host.ConfigureContainer<ContainerBuilder>(containerBuilder =>
    containerBuilder.RegisterModule<Proxytrace.Proxy.Module>());

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

// The browser AI runtime (Tracey) calls this proxy directly from the frontend origin, so it needs a
// CORS policy. Origin is config-driven (Cors:FrontendOrigin) and dev-defaults to the Vite dev server.
const string traceyCorsPolicy = "TraceyFrontend";
var frontendOrigin = builder.Configuration["Cors:FrontendOrigin"] ?? "http://localhost:4201";
builder.Services.AddCors(options =>
    options.AddPolicy(traceyCorsPolicy, policy =>
        policy.WithOrigins(frontendOrigin)
            .WithMethods("POST", "OPTIONS")
            .WithHeaders("Authorization", "Content-Type")));

var app = builder.Build();

app.UseCors(traceyCorsPolicy);

app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();
