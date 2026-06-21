using System.Reflection;
using System.Security.Claims;
using Autofac;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Proxytrace.Api.Auth;
using Proxytrace.Api.Auth.Kiosk;
using Proxytrace.Api.Auth.Mcp;
using Proxytrace.Api.Configuration;
using Proxytrace.Api.Middleware;
using Proxytrace.Api.Middleware.Exceptions;
using Proxytrace.Application.AuditLog;
using Proxytrace.Application.Auth;
using Proxytrace.Application.Auth.Local;
using Proxytrace.Application.Cleanup;
using Proxytrace.Application.Demo;
using Proxytrace.Application.ErrorLog;
using Proxytrace.Application.Pricing;
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
using Proxytrace.Application.Updates;
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
            .AddJsonFile("appsettings.local.json", optional: true, reloadOnChange: false)
            .AddEnvironmentVariables()
            .Build();

        builder
            .RegisterInstance(configuration)
            .As<IConfiguration>();

        // Container deployments set PROXYTRACE_DATA_DIR (a mounted volume); the generated
        // signing key is persisted there so it survives container recreation. Outside
        // containers the key goes to appsettings.local.json as before.
        var dataDirectory = Environment.GetEnvironmentVariable("PROXYTRACE_DATA_DIR");
        if (string.IsNullOrWhiteSpace(dataDirectory))
        {
            builder
                .RegisterType<AppSettingsLocalSigningKeyStore>()
                .As<ISigningKeyStore>()
                .SingleInstance();
        }
        else
        {
            builder
                .RegisterInstance(new DataDirectorySigningKeyStore(dataDirectory))
                .As<ISigningKeyStore>()
                .SingleInstance();
        }

        builder
            .RegisterType<SigningKeyProvider>()
            .As<ISigningKeyProvider>()
            .SingleInstance();

        var dataProtectionDir = Environment.GetEnvironmentVariable("PROXYTRACE_DATA_DIR");
        builder.RegisterServiceCollection(services =>
        {
            var dp = services.AddDataProtection().SetApplicationName("Proxytrace");
            if (!string.IsNullOrWhiteSpace(dataProtectionDir))
            {
                dp.PersistKeysToFileSystem(
                    new DirectoryInfo(Path.Combine(dataProtectionDir, "dataprotection-keys")));
            }
        });

        var kiosk = configuration.GetSection("Kiosk").Get<KioskOptions>() ?? new KioskOptions();
        builder
            .RegisterInstance(kiosk)
            .SingleInstance();

        // Optional real LLM endpoint for a fully functional kiosk demo. When the Kiosk:Endpoint
        // section is present, validate it up front (fail fast on partial/invalid config) so the
        // seeded provider/model/endpoint can power Tracey chat and test runs against a real LLM.
        var kioskEndpointSection = configuration.GetSection("Kiosk:Endpoint");
        var kioskEndpoint = kioskEndpointSection.Get<KioskEndpointOptions>() ?? new KioskEndpointOptions();
        if (kioskEndpointSection.Exists())
        {
            kioskEndpoint.Resolve();
        }
        builder
            .RegisterInstance(kioskEndpoint)
            .SingleInstance();

        var agentCallCleanupConfiguration = configuration.GetSection("AgentCallCleanup")
            .Get<AgentCallCleanupConfiguration>() ?? new AgentCallCleanupConfiguration();
        builder
            .RegisterInstance(agentCallCleanupConfiguration)
            .SingleInstance();

        var errorLogCleanupConfiguration = configuration.GetSection("ErrorLogCleanup")
            .Get<ErrorLogCleanupConfiguration>() ?? new ErrorLogCleanupConfiguration();
        builder
            .RegisterInstance(errorLogCleanupConfiguration)
            .SingleInstance();

        var auditLogCleanupConfiguration = configuration.GetSection("AuditLogCleanup")
            .Get<AuditLogCleanupConfiguration>() ?? new AuditLogCleanupConfiguration();
        builder
            .RegisterInstance(auditLogCleanupConfiguration)
            .SingleInstance();

        var priceRefreshConfiguration = configuration.GetSection("Pricing")
            .Get<PriceRefreshConfiguration>() ?? new PriceRefreshConfiguration();
        builder
            .RegisterInstance(priceRefreshConfiguration)
            .SingleInstance();

        var updatesConfiguration = configuration.GetSection("Updates")
            .Get<UpdatesConfiguration>() ?? new UpdatesConfiguration();
        builder
            .RegisterInstance(updatesConfiguration)
            .SingleInstance();

        var ingestionProxy = configuration.GetSection("Proxy")
            .Get<IngestionProxyOptions>() ?? new IngestionProxyOptions();
        builder
            .RegisterInstance(ingestionProxy)
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

            // Upstream client for Tracey's same-origin chat passthrough (forwards to the project's
            // provider). Long timeout to accommodate streamed completions.
            services.AddHttpClient("tracey-upstream", client => client.Timeout = TimeSpan.FromMinutes(5));
        });

        // Ingestion transport (consumer side). The standalone proxy service publishes captured
        // calls onto this stream; the AgentCallIngestionWorker registered by Application.Module
        // consumes and persists them. Registered before the storage/application modules so this
        // configured stream wins over their in-process default.
        builder.RegisterModule(new Proxytrace.Messaging.Module(BuildMessagingConfiguration(configuration, kiosk.Enabled)));
        builder.Properties["Proxytrace.Messaging.Registered"] = true;

        // Register the licensing module with the environment-derived configuration and claim the
        // shared guard key BEFORE the storage module loads (which pulls in Application.Module, whose
        // Free-tier fallback registers a JWT-less licensing module only when this key is absent).
        // The guard also makes an accidental double registration here a no-op.
        if (!builder.Properties.ContainsKey(Proxytrace.Licensing.Module.RegisteredKey))
        {
            builder.Properties[Proxytrace.Licensing.Module.RegisteredKey] = true;
            builder.RegisterModule(new Proxytrace.Licensing.Module(BuildLicensingConfiguration(configuration, kiosk.Enabled)));
        }

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

        // Single registration: the global filter (Program.cs options.Filters.Add<T>()) resolves the
        // enforcement filter per request from the scope, so only the scoped registration is needed.
        builder.RegisterServiceCollection(services =>
            services.AddScoped<Auth.Licensing.LicenseEnforcementFilter>());

        builder.RegisterType<CurrentUserAccessor>()
            .As<ICurrentUserAccessor>()
            .InstancePerLifetimeScope();

        // Synchronous, DB-free actor snapshot for audit capture (the singleton audit logger can't take
        // a scoped ICurrentUserAccessor). Reads the request context via IHttpContextAccessor.
        builder.RegisterType<HttpContextAuditActorAccessor>()
            .As<IAuditActorAccessor>()
            .SingleInstance();

        builder.RegisterAssemblyTypes(typeof(Module).Assembly)
            .Where(t => typeof(IExceptionMapper).IsAssignableFrom(t) && !t.IsAbstract && !t.IsInterface)
            .As<IExceptionMapper>()
            .SingleInstance();

        builder.RegisterType<ToolDtoMapper>().AsSelf().SingleInstance();
        builder.RegisterType<AgentDtoMapper>().AsSelf().SingleInstance();
        builder.RegisterType<AgentCallDtoMapper>().AsSelf().SingleInstance();
        builder.RegisterType<OptimizationProposalDtoMapper>().AsSelf().SingleInstance();
        builder.RegisterType<Dto.Notifications.NotificationDtoMapper>().AsSelf().SingleInstance();
        builder.RegisterType<Dto.Theories.TheoryDtoMapper>().AsSelf().SingleInstance();
        builder.RegisterType<EvaluatorDtoMapper>().AsSelf().SingleInstance();
        builder.RegisterType<ModelProviderDtoMapper>().AsSelf().SingleInstance();
        builder.RegisterType<TestRunDtoMapper>().AsSelf().SingleInstance();
        builder.RegisterType<TestSuiteDtoMapper>().AsSelf().SingleInstance();
        builder.RegisterType<EvaluatorBuilder>().AsSelf().SingleInstance();

        builder.RegisterType<Mcp.McpProjectAccessor>()
            .As<Mcp.IMcpProjectAccessor>()
            .InstancePerLifetimeScope();

        // MCP server: external agents call Proxytrace functionality over /mcp, authenticated by a
        // Proxytrace API key whose project scopes the call. Disabled in kiosk (no accounts/keys, and
        // KioskReadOnlyMiddleware 403s the POST anyway). The SDK instantiates the tool classes per
        // invocation from this container, so register them AsSelf.
        if (!kiosk.Enabled)
        {
            builder.RegisterAssemblyTypes(typeof(Module).Assembly)
                .Where(t => t.GetCustomAttribute<ModelContextProtocol.Server.McpServerToolTypeAttribute>() is not null)
                .AsSelf()
                .InstancePerLifetimeScope();

            builder.RegisterServiceCollection(services =>
                services
                    .AddMcpServer()
                    .WithHttpTransport(options => options.Stateless = true)
                    .WithToolsFromAssembly(typeof(Module).Assembly)
                    .WithPromptsFromAssembly(typeof(Module).Assembly));
        }

        ConfigureAuth(builder, configuration, kiosk);

        SearchConfiguration searchConfiguration =
            configuration.GetSection("Search").Get<SearchConfiguration>() ?? new SearchConfiguration();
        builder.RegisterInstance(searchConfiguration);

        var testRunnerConfiguration = configuration.GetSection("TestRunner").Get<TestRunnerConfiguration>()
            ?? new TestRunnerConfiguration();
        builder.RegisterInstance(testRunnerConfiguration);

        var securityHeadersOptions = configuration.GetSection("SecurityHeaders").Get<SecurityHeadersOptions>()
            ?? new SecurityHeadersOptions();
        securityHeadersOptions.Validate();
        builder.RegisterInstance(securityHeadersOptions);

        var searchRequestOptions = configuration.GetSection("Search:Requests").Get<SearchRequestOptions>()
            ?? new SearchRequestOptions();
        searchRequestOptions.Validate();
        builder.RegisterInstance(searchRequestOptions);

        var statisticsOptions = configuration.GetSection("Statistics").Get<StatisticsOptions>()
            ?? new StatisticsOptions();
        statisticsOptions.Validate();
        builder.RegisterInstance(statisticsOptions);
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
                    .AddJwtBearer()
                    // Additional scheme for the MCP endpoint only (pinned via the "Mcp" policy in
                    // Program.cs). The default scheme stays JwtBearer, so every existing [Authorize]
                    // controller is unaffected.
                    .AddScheme<AuthenticationSchemeOptions, McpApiKeyAuthenticationHandler>(
                        McpApiKeyAuthenticationHandler.SchemeName, _ => { });

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

    private static Proxytrace.Licensing.LicensingConfiguration BuildLicensingConfiguration(IConfiguration configuration, bool kioskEnabled)
    {
        var section = configuration.GetSection("Licensing");

#if DEBUG
        var serverUrl = Environment.GetEnvironmentVariable("PROXYTRACE_LICENSE_SERVER_URL")
                        ?? "https://license.proxytrace.dev";
        var keyOverride = Environment.GetEnvironmentVariable("PROXYTRACE_LICENSE_PUBLIC_KEY");
        // Debug only: allow disabling the server check (defaults off) so local dev does not
        // need the license server reachable.
        var serverCheckEnabled = section.GetValue<bool?>("ServerCheckEnabled") ?? false;
#else
        const string serverUrl = "https://license.proxytrace.dev";
        string? keyOverride = null;
        // Release builds MUST always contact the license server; the config override is ignored.
        const bool serverCheckEnabled = true;
#endif

        // Env var wins; fall back to the "Licensing:License" config value so a license can be set
        // in appsettings.local.json for local debugging and testing without an environment variable.
        var licenseJwt = (Environment.GetEnvironmentVariable("PROXYTRACE_LICENSE")
                          ?? section.GetValue<string>("License"))?.Trim();

        var cachePath = Environment.GetEnvironmentVariable("PROXYTRACE_LICENSE_CACHE_PATH");
        if (string.IsNullOrWhiteSpace(cachePath))
        {
            // Prefer the mounted data directory in containers — the offline-grace cache must
            // survive container recreation to anchor the grace window correctly.
            var dataDirectory = Environment.GetEnvironmentVariable("PROXYTRACE_DATA_DIR");
            cachePath = string.IsNullOrWhiteSpace(dataDirectory)
                ? Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "proxytrace",
                    "license-cache.json")
                : Path.Combine(dataDirectory, "license-cache.json");
        }

        IReadOnlyList<string> keys = string.IsNullOrWhiteSpace(keyOverride)
            ? Proxytrace.Licensing.LicensePublicKeys.GetActiveKeys()
            : keyOverride.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return new Proxytrace.Licensing.LicensingConfiguration
        {
            ServerUrl = serverUrl,
            PublicKeys = keys,
            LicenseJwt = string.IsNullOrEmpty(licenseJwt) ? null : licenseJwt,
            ServerCheckEnabled = serverCheckEnabled,
            CheckIntervalHours = section.GetValue<int?>("CheckIntervalHours") ?? 24,
            OfflineGracePeriodDays = section.GetValue<int?>("OfflineGracePeriodDays") ?? 7,
            CacheFilePath = cachePath,

            // Kiosk/demo deployments always run on a fake, perpetual Enterprise license so the
            // full feature set is visible without a real signed JWT.
            OverrideSnapshot = kioskEnabled
                ? Proxytrace.Licensing.LicenseSnapshot.Enterprise("kiosk@proxytrace.dev")
                : null,
        };
    }

    private static Proxytrace.Messaging.MessagingConfiguration BuildMessagingConfiguration(IConfiguration configuration, bool kioskEnabled)
    {
        var messaging = configuration.GetSection("Messaging");

        // Kiosk is inherently single-process and in-memory: there is no separate proxy producer
        // and no Redis-fed consumer, so ingestion always uses the in-process channel. Force it
        // regardless of config (mirrors the kiosk -> StorageConfiguration.InMemory() choice above).
        var provider = kioskEnabled
            ? Proxytrace.Messaging.MessagingProvider.InProcess
            : Enum.TryParse<Proxytrace.Messaging.MessagingProvider>(
                messaging.GetValue<string>("Provider"), ignoreCase: true, out var parsed)
                ? parsed
                : Proxytrace.Messaging.MessagingProvider.Redis;

        // Parallel persistence is only safe on Redis (it redelivers unacked entries when a race is
        // requeued); the in-process channel must stay serial. So concurrency defaults to 1 and only
        // the Redis path opts into a higher degree.
        var maxConcurrency = provider == Proxytrace.Messaging.MessagingProvider.Redis
            ? Math.Max(1, messaging.GetValue<int?>("MaxConcurrency") ?? 4)
            : 1;

        return new Proxytrace.Messaging.MessagingConfiguration
        {
            Provider = provider,
            RedisConnectionString = configuration.GetSection("Redis").GetValue<string>("ConnectionString")
                                    ?? "localhost:6379",
            Stream = messaging.GetValue<string>("Stream") ?? "proxytrace:ingest",
            ConsumerGroup = messaging.GetValue<string>("ConsumerGroup") ?? "proxytrace-app",
            ConsumerName = messaging.GetValue<string>("ConsumerName") ?? Environment.MachineName,
            BatchSize = Math.Max(1, messaging.GetValue<int?>("BatchSize") ?? 64),
            MaxConcurrency = maxConcurrency,
        };
    }

}