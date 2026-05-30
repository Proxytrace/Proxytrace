using System.Security.Claims;
using Autofac;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Proxytrace.Api.Auth;
using Proxytrace.Api.Auth.Kiosk;
using Proxytrace.Application.Auth;
using Proxytrace.Application.Auth.Local;
using Proxytrace.Application.Cleanup;
using Proxytrace.Application.Demo;
using Proxytrace.Application.Search;
using Proxytrace.Api.Dto.AgentCalls;
using Proxytrace.Api.Dto.Agents;
using Proxytrace.Api.Dto.Evaluators;
using Proxytrace.Api.Dto.ModelProviders;
using Proxytrace.Api.Dto.Proposals;
using Proxytrace.Api.Dto.TestRuns;
using Proxytrace.Api.Dto.TestSuites;
using Proxytrace.Api.Dto.Tools;
using Proxytrace.Api.Evaluators;
using Proxytrace.Application.TestRun;
using Proxytrace.Common.DependencyInjection;
using Proxytrace.Storage;

namespace Proxytrace.Api;

internal sealed class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);
        
        builder.RegisterModule<Infrastructure.Module>();

        ConfigurationBuilder configurationBuilder = new ConfigurationBuilder();
        IConfiguration configuration = configurationBuilder
            .AddJsonFile("appsettings.json", optional: false, reloadOnChange: false)
            .AddJsonFile("appsettings.development.json", optional: true, reloadOnChange: false)
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
        
        var agentCallCleanupConfiguration = configuration.GetSection("AgentCallCleanup")
            .Get<AgentCallCleanupConfiguration>() ?? new AgentCallCleanupConfiguration();
        builder
            .RegisterInstance(agentCallCleanupConfiguration)
            .SingleInstance();

        var selfBaseUrl = configuration.GetSection("Self").GetValue<string>("BaseUrl")
                          ?? "http://localhost:5000";

        builder.RegisterServiceCollection(services =>
        {
            services.AddHttpClient("self", client =>
            {
                client.BaseAddress = new Uri(selfBaseUrl.TrimEnd('/') + "/");
                client.Timeout = TimeSpan.FromMinutes(10);
            });
        });

        // Ingestion transport (consumer side). The standalone proxy service publishes captured
        // calls onto this stream; the AgentCallIngestionWorker registered by Application.Module
        // consumes and persists them. Registered before the storage/application modules so this
        // configured stream wins over their in-process default.
        builder.RegisterModule(new Proxytrace.Messaging.Module(BuildMessagingConfiguration(configuration)));
        builder.Properties["Proxytrace.Messaging.Registered"] = true;

        // Register the licensing module with the environment-derived configuration and claim the
        // guard key BEFORE the storage module loads (which pulls in Application.Module, whose
        // Free-tier fallback would otherwise register a second, JWT-less licensing module).
        builder.RegisterModule(new Proxytrace.Licensing.Module(BuildLicensingConfiguration(configuration)));
        builder.Properties["Proxytrace.Licensing.Registered"] = true;

        StorageConfiguration storageConfig;
        if (kiosk.Enabled)
        {
            storageConfig = StorageConfiguration.InMemory();
        }
        else
        {
            var connectionString = configuration.GetConnectionString("Default")
                                   ?? throw new InvalidOperationException("Connection string 'Default' is required.");
            storageConfig = StorageConfiguration.Postgres(connectionString);
        }

        builder.RegisterModule(new Storage.Module(_ => storageConfig));
        
        builder.RegisterModule<Domain.Module>();
        builder.RegisterModule<Application.Module>();

        builder.RegisterType<Auth.Licensing.LicenseEnforcementFilter>().AsSelf();
        builder.RegisterServiceCollection(services =>
            services.AddScoped<Auth.Licensing.LicenseEnforcementFilter>());

        builder.RegisterType<CurrentUserAccessor>()
            .As<ICurrentUserAccessor>()
            .InstancePerLifetimeScope();

        builder.RegisterType<ToolDtoMapper>().AsSelf().SingleInstance();
        builder.RegisterType<AgentDtoMapper>().AsSelf().SingleInstance();
        builder.RegisterType<AgentCallDtoMapper>().AsSelf().SingleInstance();
        builder.RegisterType<OptimizationProposalDtoMapper>().AsSelf().SingleInstance();
        builder.RegisterType<EvaluatorDtoMapper>().AsSelf().SingleInstance();
        builder.RegisterType<ModelProviderDtoMapper>().AsSelf().SingleInstance();
        builder.RegisterType<TestRunDtoMapper>().AsSelf().SingleInstance();
        builder.RegisterType<TestSuiteDtoMapper>().AsSelf().SingleInstance();
        builder.RegisterType<EvaluatorBuilder>().AsSelf().SingleInstance();

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
            else
            {
                services
                    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                    .AddJwtBearer();

                if (authOptions.Mode == AuthMode.Local)
                {
                    builder.RegisterType<LocalUserResolver>()
                        .As<IAuthUserResolver>()
                        .InstancePerLifetimeScope();

                    services.AddSingleton<LocalAuthOptions>(sp =>
                    {
                        var signingKeyProvider = sp.GetRequiredService<ISigningKeyProvider>();
                        var signingKey = signingKeyProvider.EnsureSigningKey(authOptions.Local.SigningKey);
                        return new LocalAuthOptions
                        {
                            SigningKey = signingKey,
                            Issuer = "proxytrace-local",
                            Audience = "proxytrace-api",
                            TokenLifetime = TimeSpan.FromDays(7),
                        };
                    });

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
                            o.Events = JwtBearerEventsFactory.Create();
                        });
                }
                else
                {
                    builder.RegisterType<JitUserResolver>()
                        .As<IAuthUserResolver>()
                        .InstancePerLifetimeScope();

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
                            o.Events = JwtBearerEventsFactory.Create();
                        });
                }
            }
        });
    }

    private static Proxytrace.Licensing.LicensingConfiguration BuildLicensingConfiguration(IConfiguration configuration)
    {
#if DEBUG
        var serverUrl = Environment.GetEnvironmentVariable("PROXYTRACE_LICENSE_SERVER_URL")
                        ?? "https://license.proxytrace.dev";
        var keyOverride = Environment.GetEnvironmentVariable("PROXYTRACE_LICENSE_PUBLIC_KEY");
#else
        const string serverUrl = "https://license.proxytrace.dev";
        string? keyOverride = null;
#endif

        var licenseJwt = Environment.GetEnvironmentVariable("PROXYTRACE_LICENSE")?.Trim();

        var cachePath = Environment.GetEnvironmentVariable("PROXYTRACE_LICENSE_CACHE_PATH");
        if (string.IsNullOrWhiteSpace(cachePath))
        {
            var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            cachePath = Path.Combine(localAppData, "proxytrace", "license-cache.json");
        }

        IReadOnlyList<string> keys = string.IsNullOrWhiteSpace(keyOverride)
            ? Proxytrace.Licensing.LicensePublicKeys.GetActiveKeys()
            : keyOverride.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var section = configuration.GetSection("Licensing");

        return new Proxytrace.Licensing.LicensingConfiguration
        {
            ServerUrl = serverUrl,
            PublicKeys = keys,
            LicenseJwt = string.IsNullOrEmpty(licenseJwt) ? null : licenseJwt,
            CheckIntervalHours = section.GetValue<int?>("CheckIntervalHours") ?? 24,
            OfflineGracePeriodDays = section.GetValue<int?>("OfflineGracePeriodDays") ?? 7,
            CacheFilePath = cachePath,
        };
    }

    private static Proxytrace.Messaging.MessagingConfiguration BuildMessagingConfiguration(IConfiguration configuration)
    {
        var messaging = configuration.GetSection("Messaging");
        var provider = Enum.TryParse<Proxytrace.Messaging.MessagingProvider>(
            messaging.GetValue<string>("Provider"), ignoreCase: true, out var parsed)
            ? parsed
            : Proxytrace.Messaging.MessagingProvider.Redis;

        return new Proxytrace.Messaging.MessagingConfiguration
        {
            Provider = provider,
            RedisConnectionString = configuration.GetSection("Redis").GetValue<string>("ConnectionString")
                                    ?? "localhost:6379",
            Stream = messaging.GetValue<string>("Stream") ?? "proxytrace:ingest",
            ConsumerGroup = messaging.GetValue<string>("ConsumerGroup") ?? "proxytrace-app",
            ConsumerName = messaging.GetValue<string>("ConsumerName") ?? Environment.MachineName,
        };
    }

}