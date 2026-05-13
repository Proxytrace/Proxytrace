using System.Security.Claims;
using Autofac;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Trsr.Api.Auth;
using Trsr.Api.Auth.Kiosk;
using Trsr.Application.Auth;
using Trsr.Application.Auth.Local;
using Trsr.Application.Demo;
using Trsr.Application.Search;
using Trsr.Application.TestRun;
using Trsr.Common.DependencyInjection;
using Trsr.Storage;

namespace Trsr.Api;

internal sealed class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);
        
        builder.RegisterModule<Infrastructure.Module>();

        ConfigurationBuilder configurationBuilder = new ConfigurationBuilder();
        IConfiguration configuration = configurationBuilder
            .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
            .AddJsonFile("appsettings.development.json", optional: true, reloadOnChange: true)
            .AddEnvironmentVariables()
            .Build();

        builder
            .RegisterInstance(configuration)
            .As<IConfiguration>();

        builder
            .RegisterType<SigningKeyProvider>()
            .As<ISigningKeyProvider>()
            .SingleInstance();
        
        var kiosk = configuration.GetSection("Kiosk").Get<KioskOptions>() ?? new KioskOptions();
        builder
            .RegisterInstance(kiosk)
            .SingleInstance();

        var upstreamBaseUrl = configuration.GetSection("ModelProvider").GetValue<string>("UpstreamBaseUrl");
        if (string.IsNullOrWhiteSpace(upstreamBaseUrl))
        {
            if (!kiosk.Enabled)
            {
                throw new InvalidOperationException("Configuration 'ModelProvider:UpstreamBaseUrl' is required. ");
            }

            upstreamBaseUrl = "http://localhost/disabled-in-kiosk";
        }

        var selfBaseUrl = configuration.GetSection("Self").GetValue<string>("BaseUrl")
                          ?? "http://localhost:5000";

        builder.RegisterServiceCollection(services =>
        {
            services.AddHttpClient("openai", client =>
            {
                client.BaseAddress = new Uri(upstreamBaseUrl.TrimEnd('/') + "/");
                client.Timeout = TimeSpan.FromMinutes(5);
            });

            services.AddHttpClient("self", client =>
            {
                client.BaseAddress = new Uri(selfBaseUrl.TrimEnd('/') + "/");
                client.Timeout = TimeSpan.FromMinutes(10);
            });
        });

        builder.RegisterModule<Domain.Module>();
        builder.RegisterModule<Application.Module>();

        StorageConfiguration storageConfig;
        if (kiosk.Enabled)
        {
            storageConfig = StorageConfiguration.InMemory();
        }
        else
        {
            var connectionString = configuration.GetConnectionString("Default")
                                   ?? throw new InvalidOperationException("Connection string 'Default' is required.");
            storageConfig = DetermineStorageConfiguration(connectionString);
        }

        builder.RegisterModule(new Storage.Module(storageConfig));

        builder.RegisterType<CurrentUserAccessor>()
            .As<ICurrentUserAccessor>()
            .InstancePerLifetimeScope();

        ConfigureAuth(builder, configuration, kiosk);

        SearchConfiguration searchConfiguration =
            configuration.GetSection("Search").Get<SearchConfiguration>() ?? new SearchConfiguration();
        builder.RegisterInstance(searchConfiguration);

        var testRunnerConfiguration = configuration.GetSection("TestRunner").Get<TestRunnerConfiguration>()
            ?? new TestRunnerConfiguration();
        builder.RegisterInstance(testRunnerConfiguration);
    }

    private void ConfigureAuth(ContainerBuilder builder, IConfiguration configuration, KioskOptions kiosk)
    {
        var authOptions = configuration.GetSection("Authentication").Get<AuthOptions>() ?? new AuthOptions();
        builder.RegisterInstance(authOptions);
        
        builder.RegisterServiceCollection(services =>
        {
            if (kiosk.Enabled)
            {
                services
                    .AddAuthentication(KioskAuthenticationHandler.SchemeName)
                    .AddScheme<AuthenticationSchemeOptions, KioskAuthenticationHandler>(
                        KioskAuthenticationHandler.SchemeName, _ => { });
            }
            else if (authOptions.Mode == AuthMode.Local)
            {
                services.AddSingleton<LocalAuthOptions>(sp =>
                {
                    var signingKeyProvider = sp.GetRequiredService<ISigningKeyProvider>();
                    var signingKey = signingKeyProvider.EnsureSigningKey(authOptions.Local.SigningKey);
                    return new LocalAuthOptions
                    {
                        SigningKey = signingKey,
                        Issuer = "trsr-local",
                        Audience = "trsr-api",
                        TokenLifetime = TimeSpan.FromDays(7),
                    };
                });

                services
                    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                    .AddJwtBearer();

                services
                    .AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
                    .Configure<LocalAuthOptions>((o, localOptions) =>
                    {
                        o.MapInboundClaims = false;
                        o.TokenValidationParameters = new TokenValidationParameters
                        {
                            ValidIssuer = localOptions.Issuer,
                            ValidAudience = localOptions.Audience,
                            ValidateIssuer = true,
                            ValidateAudience = true,
                            ValidateIssuerSigningKey = true,
                            IssuerSigningKey = new SymmetricSecurityKey(
                                System.Text.Encoding.UTF8.GetBytes(localOptions.SigningKey)),
                            RoleClaimType = ClaimTypes.Role,
                        };
                        o.Events = LocalAuthEvents.Create();
                    });
            }
            else
            {
                services
                    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                    .AddJwtBearer();

                services
                    .AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
                    .Configure<AuthOptions>((o, opts) =>
                    {
                        o.Authority = opts.Oidc.Authority;
                        o.Audience = opts.Oidc.Audience;
                        o.RequireHttpsMetadata = opts.Oidc.RequireHttpsMetadata;
                        o.MapInboundClaims = false;
                        o.TokenValidationParameters = new TokenValidationParameters
                        {
                            ValidateIssuer = true,
                            ValidateAudience = !string.IsNullOrWhiteSpace(opts.Oidc.Audience),
                            ValidAudience = opts.Oidc.Audience,
                            NameClaimType = opts.Oidc.NameClaimType,
                            RoleClaimType = ClaimTypes.Role,
                        };
                        o.Events = JitProvisioningEvents.Create();
                    });
            }
        });
    }

    private static StorageConfiguration DetermineStorageConfiguration(string connectionString)
    {
        if (IsPostgresConnectionString(connectionString))
        {
            return StorageConfiguration.Postgres(connectionString);
        }

        return IsSqliteConnectionString(connectionString)
            ? StorageConfiguration.Sqlite(connectionString)
            : StorageConfiguration.SqlServer(connectionString);
    }

    // Npgsql connection strings use "Host=" whereas SQL Server uses "Server=" / "Data Source="
    private static bool IsPostgresConnectionString(string connectionString)
        => connectionString.Contains("host=", StringComparison.OrdinalIgnoreCase)
           || connectionString.Contains("port=", StringComparison.OrdinalIgnoreCase);

    // SQLite connection strings typically use "Data Source=" followed by a file path
    private static bool IsSqliteConnectionString(string connectionString)
        => connectionString.Contains("data source=", StringComparison.OrdinalIgnoreCase)
           && (connectionString.Contains(".db", StringComparison.OrdinalIgnoreCase)
               || connectionString.Contains(".sqlite", StringComparison.OrdinalIgnoreCase)
               || connectionString.Contains(":memory:", StringComparison.OrdinalIgnoreCase));
}