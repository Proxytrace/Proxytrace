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
