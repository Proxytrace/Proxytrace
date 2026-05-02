using Autofac;
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
        builder.RegisterModule(new Application.Module(isDevelopment: isDevelopment));

        var connectionString = configuration.GetConnectionString("Default")
                               ?? throw new InvalidOperationException("Connection string 'Default' is required.");
        var storageConfig = DetermineStorageConfiguration(connectionString);
        builder.RegisterModule(new Storage.Module(storageConfig));
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
