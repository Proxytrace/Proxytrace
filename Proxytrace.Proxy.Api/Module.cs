using Autofac;
using Microsoft.Extensions.DependencyInjection;
using Nordstein.Core.Common.DependencyInjection;
using Proxytrace.Domain.Kiosk;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Messaging;
using Proxytrace.Proxy.Api.Internal;
using Proxytrace.Storage;

namespace Proxytrace.Proxy.Api;

/// <summary>
/// Composition root for the lean ingestion proxy host. Registers the storage, messaging, and
/// infrastructure foundation that the proxy pipeline needs, plus the factory-delegate stubs. Loads
/// <see cref="Proxytrace.Proxy.Module"/> for the shared pipeline types.
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

        // The proxy controller reads this to decide whether kiosk mode has a live upstream to
        // forward to (kiosk + no endpoint refuses; a configured endpoint serves). The standalone
        // host is normally non-kiosk, but bind it so the controller can always resolve it.
        var kioskEndpoint = configuration.GetSection("Kiosk:Endpoint").Get<KioskEndpointOptions>()
                            ?? new KioskEndpointOptions();
        builder.RegisterInstance(kioskEndpoint).SingleInstance();

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
        // provider key before replaying it. The seam interfaces live in Nordstein.Core and their Data
        // Protection-backed implementation + DI module live in the infrastructure layer; this lean host
        // does NOT load Application, so it registers that infrastructure module directly (#270). The
        // shared key-ring configuration (same app name + PROXYTRACE_DATA_DIR) lets the proxy decrypt
        // keys the API encrypted — both hosts MUST point PROXYTRACE_DATA_DIR at the same volume. See
        // docs/security.md.
        builder.RegisterModule<Proxytrace.Infrastructure.Security.SecretProtectionModule>();

        // The storage model-building graph references IAgentNameGenerator (implemented in the
        // application layer we do not load). The proxy never creates agents, so a stub suffices.
        builder.RegisterType<UnusedAgentNameGenerator>()
            .As<IAgentNameGenerator>()
            .SingleInstance();

        // Reconstituting a ModelProvider domain entity (during API-key resolution) needs an
        // IProviderClient.Factory. The proxy never calls CreateClient, so a stub suffices and lets
        // Autofac auto-generate the delegate factory without pulling in Infrastructure.Module.
        builder.RegisterType<UnusedProviderClient>()
            .As<IProviderClient>();

        // Load the shared proxy pipeline: controller, API-key resolver, request blocker,
        // blocking-rule provider, IMemoryCache, and HTTP clients.
        builder.RegisterModule<Proxytrace.Proxy.Module>();
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
