using Autofac;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Application.Agent;
using Trsr.Application.Auth;
using Trsr.Application.Auth.Internal;
using Trsr.Application.Cleanup;
using Trsr.Application.Cleanup.Internal;
using Trsr.Application.Evaluator;
using Trsr.Application.Evaluator.Internal;
using Trsr.Application.Setup;
using Trsr.Application.Setup.Internal;
using Trsr.Application.Ingestion.Internal;
using Trsr.Application.Search;
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
        builder.RegisterModule<Statistics.Module>();
        builder.RegisterModule<Playground.PlaygroundModule>();

        builder.RegisterModule(new Search.SearchModule(cb =>
        {
            var config = this.configuration?.GetSection("Search").Get<SearchConfiguration>();
            return config ?? new SearchConfiguration();            
        }));

        builder.RegisterType<AgentNameGenerator>()
            .As<IAgentNameGenerator>()
            .SingleInstance();
        
        builder.Register<TestRunnerConfiguration>(_ =>
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
        
        builder.RegisterType<DataCleanupService>()
            .As<IDataCleanupService>()
            .SingleInstance();

        builder.RegisterType<SetupService>()
            .As<ISetupService>()
            .SingleInstance();

        builder.RegisterType<JitUserProvisioner>()
            .As<IJitUserProvisioner>()
            .SingleInstance();

        builder.RegisterType<Auth.Local.Internal.PasswordPolicy>()
            .As<Auth.Local.IPasswordPolicy>()
            .SingleInstance();

        builder.RegisterInstance(Prompts.ResourceManager);

        builder.RegisterType<AgenticEvaluatorPresets>()
            .As<IAgenticEvaluatorPresets>()
            .SingleInstance();
    }
}
