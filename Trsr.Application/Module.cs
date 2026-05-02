using Autofac;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Application.Agent;
using Trsr.Application.Demo.Internal;
using Trsr.Application.Ingestion.Internal;
using Trsr.Application.Streaming;
using Trsr.Application.Streaming.Internal;
using Trsr.Application.TestRun.Internal;
using Trsr.Common.DependencyInjection;
using Trsr.Domain.Agent;

namespace Trsr.Application;

public sealed class Module : Autofac.Module
{
    private readonly bool isDevelopment;

    public Module() : this(false)
    {
    }
    
    public Module(bool isDevelopment)
    {
        this.isDevelopment = isDevelopment;
    }
    
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

        builder.RegisterType<EventBroadcaster>()
            .As<ITraceBroadcaster>()
            .As<ITestResultBroadcaster>()
            .SingleInstance();

        builder.RegisterType<AgentNameGenerator>()
            .As<IAgentNameGenerator>()
            .SingleInstance();
        
        builder.RegisterType<TestRunnerService>()
            .AsImplementedInterfaces()
            .AsSelf()
            .SingleInstance();

        builder.RegisterServiceCollection(services 
            => services.AddHostedService(sc => sc.GetRequiredService<TestRunnerService>()));
        
        builder.RegisterType<OpenAiCallParser>()
            .As<IOpenAiCallParser>()
            .SingleInstance();

        builder.RegisterType<AgentCallIngestor>()
            .AsImplementedInterfaces()
            .AsSelf()
            .SingleInstance();

        builder.RegisterServiceCollection(services =>
        {
            services.AddHostedService(sc => sc.GetRequiredService<AgentCallIngestor>());
        });
        
        if (isDevelopment)
        {
            builder.RegisterServiceCollection(services =>
            {
                services.AddHostedService<DemoDataSeeder>();
            });
        }
    }
}
