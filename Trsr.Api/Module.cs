using Autofac;
using Trsr.Api.Services;
using Trsr.Api.Services.Internal;
using Trsr.Common.DependencyInjection;
using Trsr.Storage;

namespace Trsr.Api;

internal sealed class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);
        
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
        
        builder.RegisterType<AgentCallIngestionService>()
            .As<IAgentCallIngestionService>()
            .InstancePerDependency();

        builder.RegisterServiceCollection(services =>
        {
            services.AddHttpClient("openai", client =>
            {
                client.BaseAddress = new Uri(upstreamBaseUrl.TrimEnd('/') + "/");
                client.Timeout = TimeSpan.FromMinutes(5);
            });
        });

        builder.RegisterModule<Domain.Module>();

        var connectionString = configuration.GetConnectionString("Default")
                               ?? throw new InvalidOperationException("Connection string 'Default' is required.");
        builder.RegisterModule(new Storage.Module(StorageConfiguration.SqlServer(connectionString)));
    }
}
