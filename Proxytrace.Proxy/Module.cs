using Autofac;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Domain.Kiosk;
using Proxytrace.Common.DependencyInjection;
using Proxytrace.Domain.ApiKey;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Project;
using Proxytrace.Messaging;
using Proxytrace.Proxy.Internal;
using Proxytrace.Storage;

namespace Proxytrace.Proxy;

/// <summary>
/// Composition root for the lean ingestion proxy host. Registers only what the proxy hot path
/// needs: read access to API keys, the upstream HTTP client, and the Redis ingestion publisher.
/// It deliberately does NOT register <c>Application.Module</c>, so none of the main app's
/// background services (test runner, optimizer, search indexing, …) run here.
/// </summary>
internal sealed class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

        IConfiguration configuration = new ConfigurationBuilder()
            .AddJsonFile("appsettings.json", optional: false, reloadOnChange: false)
            .AddJsonFile("appsettings.development.json", optional: true, reloadOnChange: false)
            .AddEnvironmentVariables()
            .Build();

        builder.RegisterInstance(configuration).As<IConfiguration>();

        var kiosk = configuration.GetSection("Kiosk").Get<KioskOptions>() ?? new KioskOptions();
        builder.RegisterInstance(kiosk).SingleInstance();

        // Redis ingestion transport (producer side). Registered before storage so the in-process
        // default the application module would otherwise pick can never take precedence.
        builder.RegisterModule(new Proxytrace.Messaging.Module(BuildMessagingConfiguration(configuration)));
        builder.Properties["Proxytrace.Messaging.Registered"] = true;

        // Storage in read-only / no-init mode: repositories without app services or schema init.
        var connectionString = configuration.GetConnectionString("Default")
                               ?? throw new InvalidOperationException("Connection string 'Default' is required.");
        StorageConfiguration storageConfig = StorageConfiguration.Postgres(connectionString);
        builder.RegisterModule(new Storage.Module(_ => storageConfig, registerApplicationServices: false));

        // The repositories the proxy resolves during API-key resolution (IApiKeyRepository,
        // IModelProviderRepository) map secret-bearing columns, so they need the at-rest secret seams:
        // ISecretHasher for the inbound-key blind index, and ISecretProtector to decrypt the upstream
        // provider key before replaying it. The seam interfaces live in the domain layer and their
        // Data Protection-backed implementation + DI module in the infrastructure layer; this lean host
        // does NOT load Application, so it registers that infrastructure module directly (#270). The
        // shared key-ring configuration (same app name + PROXYTRACE_DATA_DIR) lets the proxy decrypt
        // keys the API encrypted — both hosts MUST point PROXYTRACE_DATA_DIR at the same volume. See
        // docs/security.md.
        builder.RegisterModule<Proxytrace.Infrastructure.Security.SecretProtectionModule>();

        // Licensing: the proxy enforces the Enterprise-gated blocking detectors at use time, so it
        // needs the real license snapshot. ServerCheckEnabled is ALWAYS false here (in both build
        // flavors): the main app owns the license-server heartbeat and the offline-grace cache file
        // in the shared PROXYTRACE_DATA_DIR — a second checker would double the heartbeats and race
        // that cache. Consequence (accepted): a revoked-but-unexpired license keeps blocking active
        // in the proxy until it expires or the stored key is removed. The DB-stored license is
        // applied and kept fresh by ProxyStoredLicenseService below (polling — the proxy cannot
        // hear the app's in-process license Changed event).
        if (!builder.Properties.ContainsKey(Proxytrace.Licensing.Module.RegisteredKey))
        {
            builder.Properties[Proxytrace.Licensing.Module.RegisteredKey] = true;
            builder.RegisterModule(new Proxytrace.Licensing.Module(BuildLicensingConfiguration(configuration, kiosk.Enabled)));
        }

        var licensePollSeconds = configuration.GetSection("Licensing").GetValue<int?>("StoredLicensePollSeconds") ?? 300;
        builder.RegisterServiceCollection(services => services.AddSingleton<Microsoft.Extensions.Hosting.IHostedService>(sp =>
            new ProxyStoredLicenseService(
                sp.GetRequiredService<ILifetimeScope>(),
                sp.GetRequiredService<Proxytrace.Licensing.ILicenseActivator>(),
                sp.GetRequiredService<Proxytrace.Licensing.ILicenseService>(),
                TimeSpan.FromSeconds(Math.Max(1, licensePollSeconds)),
                sp.GetRequiredService<ILogger<ProxyStoredLicenseService>>())));

        // The storage model-building graph references IAgentNameGenerator (implemented in the
        // application layer we do not load). The proxy never creates agents, so a stub suffices.
        builder.RegisterType<UnusedAgentNameGenerator>()
            .As<Proxytrace.Domain.Agent.IAgentNameGenerator>()
            .SingleInstance();

        // Reconstituting a ModelProvider domain entity (during API-key resolution) needs an
        // IProviderClient.Factory. The proxy never calls CreateClient, so a stub suffices and lets
        // Autofac auto-generate the delegate factory without pulling in Infrastructure.Module.
        builder.RegisterType<UnusedProviderClient>()
            .As<Proxytrace.Domain.ModelProvider.IProviderClient>();

        var cacheTtlSeconds = configuration.GetSection("ApiKeyCache").GetValue<int?>("TtlSeconds") ?? 30;
        // Per-request lifetime, NOT SingleInstance: a singleton resolver captures its repositories
        // (and their per-call StorageDbContext) against the root scope, so the InstancePerDependency
        // contexts created on every cache-miss are never disposed until shutdown — a connection leak.
        // The cache that actually has to be shared is IMemoryCache, which is already a singleton.
        builder.Register(ctx => new CachedApiKeyResolver(
                ctx.Resolve<IApiKeyRepository>(),
                ctx.Resolve<IModelProviderRepository>(),
                ctx.Resolve<IProjectRepository>(),
                ctx.Resolve<IMemoryCache>(),
                TimeSpan.FromSeconds(cacheTtlSeconds)))
            .As<IApiKeyResolver>()
            .InstancePerLifetimeScope();

        // Real-time blocking anomaly detectors: same per-lifetime-scope reasoning as the key
        // resolver above (the repository holds a per-call StorageDbContext); the shared state is
        // the singleton IMemoryCache.
        var blockingTtlSeconds = configuration.GetSection("BlockingRuleCache").GetValue<int?>("TtlSeconds") ?? 30;
        builder.Register(ctx => new CachedBlockingRuleProvider(
                ctx.Resolve<Proxytrace.Domain.CustomAnomaly.ICustomAnomalyDetectorRepository>(),
                ctx.Resolve<Proxytrace.Licensing.ILicenseService>(),
                ctx.Resolve<IMemoryCache>(),
                TimeSpan.FromSeconds(blockingTtlSeconds),
                ctx.Resolve<ILogger<CachedBlockingRuleProvider>>()))
            .As<IBlockingRuleProvider>()
            .InstancePerLifetimeScope();

        builder.RegisterType<RequestBlocker>()
            .As<IRequestBlocker>()
            .InstancePerLifetimeScope();

        builder.RegisterServiceCollection(services =>
        {
            services.AddMemoryCache();
            // The upstream target is per-request (provider endpoint), so only the timeout matters here.
            services.AddHttpClient("openai", client => client.Timeout = TimeSpan.FromMinutes(5));

            // Non-LLM pass-through relays redirects to the client verbatim instead of following them
            // server-side (the BCL would also strip Authorization on the redirect hop), so it needs
            // its own handler with auto-redirect off.
            services.AddHttpClient("passthrough", client => client.Timeout = TimeSpan.FromMinutes(5))
                .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler { AllowAutoRedirect = false });
        });
    }

    private static Proxytrace.Licensing.LicensingConfiguration BuildLicensingConfiguration(
        IConfiguration configuration,
        bool kioskEnabled)
    {
        var section = configuration.GetSection("Licensing");

#if DEBUG
        var serverUrl = Environment.GetEnvironmentVariable("PROXYTRACE_LICENSE_SERVER_URL")
                        ?? "https://license.proxytrace.dev";
        var keyOverride = Environment.GetEnvironmentVariable("PROXYTRACE_LICENSE_PUBLIC_KEY");
#else
        const string serverUrl = "https://license.proxytrace.dev";
        string? keyOverride = null;
#endif

        // Env var wins; fall back to the "Licensing:License" config value (mirrors the API host).
        var licenseJwt = (Environment.GetEnvironmentVariable("PROXYTRACE_LICENSE")
                          ?? section.GetValue<string>("License"))?.Trim();

        // With ServerCheckEnabled=false this file is never written; a distinct name keeps it from
        // ever colliding with the API's offline-grace cache in the shared data directory.
        var dataDirectory = Environment.GetEnvironmentVariable("PROXYTRACE_DATA_DIR");
        var cachePath = string.IsNullOrWhiteSpace(dataDirectory)
            ? Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "proxytrace",
                "license-cache.proxy.json")
            : Path.Combine(dataDirectory, "license-cache.proxy.json");

        IReadOnlyList<string> keys = string.IsNullOrWhiteSpace(keyOverride)
            ? Proxytrace.Licensing.LicensePublicKeys.GetActiveKeys()
            : keyOverride.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return new Proxytrace.Licensing.LicensingConfiguration
        {
            ServerUrl = serverUrl,
            PublicKeys = keys,
            LicenseJwt = string.IsNullOrEmpty(licenseJwt) ? null : licenseJwt,
            // Always false in the proxy — see the registration comment above.
            ServerCheckEnabled = false,
            CacheFilePath = cachePath,

            // Kiosk/demo deployments always run on a fake, perpetual Enterprise license (the proxy
            // refuses traffic in kiosk mode anyway, but the snapshot keeps container build sane).
            OverrideSnapshot = kioskEnabled
                ? Proxytrace.Licensing.LicenseSnapshot.Enterprise("kiosk@proxytrace.dev")
                : null,
        };
    }

    private static MessagingConfiguration BuildMessagingConfiguration(IConfiguration configuration)
    {
        var messaging = configuration.GetSection("Messaging");
        return new MessagingConfiguration
        {
            Provider = MessagingProvider.Redis,
            RedisConnectionString = configuration.GetSection("Redis").GetValue<string>("ConnectionString")
                                    ?? "localhost:6379",
            Stream = messaging.GetValue<string>("Stream") ?? "proxytrace:ingest",
            ConsumerGroup = messaging.GetValue<string>("ConsumerGroup") ?? "proxytrace-app",
        };
    }

}
