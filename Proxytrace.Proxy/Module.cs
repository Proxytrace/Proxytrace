using Autofac;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Application.Demo;
using Proxytrace.Common.DependencyInjection;
using Proxytrace.Domain.ApiKey;
using Proxytrace.Messaging;
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
        StorageConfiguration storageConfig = DetermineStorageConfiguration(connectionString);
        builder.RegisterModule(new Storage.Module(_ => storageConfig, registerApplicationServices: false));

        // The storage model-building graph references IAgentNameGenerator (implemented in the
        // application layer we do not load). The proxy never creates agents, so a stub suffices.
        builder.RegisterType<UnusedAgentNameGenerator>()
            .As<Proxytrace.Domain.Agent.IAgentNameGenerator>()
            .SingleInstance();

        var cacheTtlSeconds = configuration.GetSection("ApiKeyCache").GetValue<int?>("TtlSeconds") ?? 30;
        builder.Register(ctx => new CachedApiKeyResolver(
                ctx.Resolve<IApiKeyRepository>(),
                TimeSpan.FromSeconds(cacheTtlSeconds)))
            .As<IApiKeyResolver>()
            .SingleInstance();

        builder.RegisterServiceCollection(services =>
        {
            // The upstream target is per-request (provider endpoint), so only the timeout matters here.
            services.AddHttpClient("openai", client => client.Timeout = TimeSpan.FromMinutes(5));
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

    private static bool IsPostgresConnectionString(string connectionString)
        => connectionString.Contains("host=", StringComparison.OrdinalIgnoreCase)
           || connectionString.Contains("port=", StringComparison.OrdinalIgnoreCase);

    private static bool IsSqliteConnectionString(string connectionString)
        => connectionString.Contains("data source=", StringComparison.OrdinalIgnoreCase)
           && (connectionString.Contains(".db", StringComparison.OrdinalIgnoreCase)
               || connectionString.Contains(".sqlite", StringComparison.OrdinalIgnoreCase)
               || connectionString.Contains(":memory:", StringComparison.OrdinalIgnoreCase));
}
