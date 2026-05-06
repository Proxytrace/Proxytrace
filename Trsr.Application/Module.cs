using Autofac;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Application.Agent;
using Trsr.Application.Demo.Internal;
using Trsr.Application.Ingestion.Internal;
using Trsr.Application.Optimization;
using Trsr.Application.Streaming;
using Trsr.Application.Streaming.Internal;
using Trsr.Application.TestRun;
using Trsr.Application.TestRun.Internal;
using Trsr.Common.DependencyInjection;
using Trsr.Domain.Agent;

namespace Trsr.Application;

public sealed class Module : Autofac.Module
{
    private readonly bool isDevelopment;
    private readonly IConfiguration? configuration;

    public Module() : this(false)
    {
    }
    
    public Module(bool isDevelopment, IConfiguration? configuration = null)
    {
        this.isDevelopment = isDevelopment;
        this.configuration = configuration;
    }
    
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

        builder.RegisterType<TraceBroadcaster>()
            .As<ITraceBroadcaster>()
            .SingleInstance();

        builder.RegisterType<TestResultBroadcaster>()
            .As<ITestResultBroadcaster>()
            .SingleInstance();

        builder.RegisterType<ProposalBroadcaster>()
            .As<IProposalBroadcaster>()
            .SingleInstance();

        builder.RegisterModule<Optimization.Module>();

        builder.RegisterType<AgentNameGenerator>()
            .As<IAgentNameGenerator>()
            .SingleInstance();
        
        builder.Register<TestRunnerConfiguration>(ctx =>
            {
                var config = this.configuration?.GetSection("TestRunner").Get<TestRunnerConfiguration>();
                return config ?? new TestRunnerConfiguration();
            })
            .As<TestRunnerConfiguration>()
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
