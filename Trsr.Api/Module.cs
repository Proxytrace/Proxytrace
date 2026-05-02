using Autofac;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Api.Services;
using Trsr.Api.Services.Internal;
using Trsr.Application;
using Trsr.Common.DependencyInjection;
using Trsr.Storage;

namespace Trsr.Api;

internal sealed class Module : Autofac.Module
{
    private readonly bool isDevelopment;

    public Module(bool isDevelopment = false)
    {
        this.isDevelopment = isDevelopment;
    }

    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);
        
        builder.RegisterModule<Infrastructure.Module>();
        
        ConfigurationBuilder configurationBuilder = new ConfigurationBuilder();
        var configuration = configurationBuilder
            .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
            .AddJsonFile("appsettings.development.json", optional: true, reloadOnChange: true)
            .Build();
        
        builder
            .RegisterInstance(configuration)
            .As<IConfiguration>();

        var upstreamBaseUrl = configuration.GetSection("ModelProvider").GetValue<string>("UpstreamBaseUrl")
                              ?? throw new InvalidOperationException("Configuration 'ModelProvider:UpstreamBaseUrl' is required. ");
        
        builder.RegisterType<OpenAiCallParser>()
            .As<IOpenAiCallParser>()
            .SingleInstance();

        builder.RegisterType<AgentCallIngestionService>()
            .As<IAgentCallIngestionService>()
            .InstancePerDependency();

        builder.RegisterType<AgentCallIngestionQueue>()
            .AsSelf()
            .As<IAgentCallIngestionQueue>()
            .SingleInstance();

        builder.RegisterServiceCollection(services =>
        {
            services.AddHostedService<AgentCallIngestionWorker>();
        });

        var selfBaseUrl = configuration.GetSection("Self").GetValue<string>("BaseUrl")
                          ?? "http://localhost:5000";

        builder.RegisterType<TestRunnerService>()
            .As<ITestRunnerService>()
            .As<ITestRunExecutor>()
            .InstancePerDependency();

        builder.RegisterType<TestRunQueue>()
            .AsSelf()
            .As<ITestRunQueue>()
            .SingleInstance();

        builder.RegisterServiceCollection(services =>
        {
            services.AddHostedService<TestRunBackgroundService>();
        });

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

        var connectionString = configuration.GetConnectionString("Default")
                               ?? throw new InvalidOperationException("Connection string 'Default' is required.");
        var storageConfig = DetermineStorageConfiguration(connectionString);
        builder.RegisterModule(new Storage.Module(storageConfig));

        if (isDevelopment)
        {
            builder.RegisterServiceCollection(services =>
            {
                services.AddHostedService<DemoDataSeeder>();
            });
        }
    }

    private static StorageConfiguration DetermineStorageConfiguration(string connectionString)
    {
        if (IsPostgresConnectionString(connectionString))
        {
            return StorageConfiguration.Postgres(connectionString);
        }
        
        if (IsSqliteConnectionString(connectionString))
        {
            return StorageConfiguration.Sqlite(connectionString);
        }
        
        // Default to SQL Server
        return StorageConfiguration.SqlServer(connectionString);
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
