using Autofac;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Trsr.Application.Agent;
using Trsr.Application.Auth;
using Trsr.Application.Auth.Internal;
using Trsr.Application.Cleanup;
using Trsr.Application.Cleanup.Internal;
using Trsr.Application.Demo;
using Trsr.Application.Demo.Internal;
using Trsr.Application.Evaluator;
using Trsr.Application.Evaluator.Internal;
using Trsr.Application.Setup;
using Trsr.Application.Setup.Internal;
using Trsr.Application.Ingestion.Internal;
using Trsr.Application.Search;
using Trsr.Application.Streaming;
using Trsr.Application.Streaming.Internal;
using Trsr.Application.TestRun.Internal;
using Trsr.Common.DependencyInjection;
using Trsr.Common.Hosting;
using Trsr.Domain.Agent;

namespace Trsr.Application;

public sealed class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

        builder.RegisterType<AgentCallCleanupService>()
            .AsSelf()
            .SingleInstance();
        builder.RegisterServiceCollection(services =>
            services.AddHostedService(sc => sc.GetRequiredService<AgentCallCleanupService>()));

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

        builder.RegisterModule<SearchModule>();

        builder.RegisterType<AgentNameGenerator>()
            .As<IAgentNameGenerator>()
            .SingleInstance();

        builder.RegisterType<TestRunnerService>()
            .AsImplementedInterfaces()
            .AsSelf()
            .SingleInstance()
            .IfNotRegistered(typeof(TestRunnerService));

        const string testRunnerHostedServiceKey = "Trsr.Application.TestRunnerService.Registered";
        if (!builder.Properties.ContainsKey(testRunnerHostedServiceKey))
        {
            builder.Properties[testRunnerHostedServiceKey] = true;
            builder.RegisterServiceCollection(services
                => services.AddSingleton<IHostedService>(sc =>
                {
                    var kiosk = sc.GetRequiredService<KioskOptions>();
                    return kiosk.Enabled
                        ? new NullHostedService()
                        : sc.GetRequiredService<TestRunnerService>();
                }));
        }

        builder.RegisterType<OpenAiCallParser>()
            .As<IOpenAiCallParser>()
            .SingleInstance();

        builder.RegisterType<AgentCallIngestor>()
            .AsImplementedInterfaces()
            .AsSelf()
            .SingleInstance()
            .IfNotRegistered(typeof(AgentCallIngestor));

        const string agentCallIngestorHostedServiceKey = "Trsr.Application.AgentCallIngestor.Registered";
        if (!builder.Properties.ContainsKey(agentCallIngestorHostedServiceKey))
        {
            builder.Properties[agentCallIngestorHostedServiceKey] = true;
            builder.RegisterServiceCollection(services =>
            {
                services.AddSingleton<IHostedService>(sc =>
                {
                    var kiosk = sc.GetRequiredService<KioskOptions>();
                    return kiosk.Enabled
                        ? new NullHostedService()
                        : sc.GetRequiredService<AgentCallIngestor>();
                });
            });
        }

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

        builder.RegisterType<Auth.Local.Internal.PasswordService>()
            .As<Auth.Local.IPasswordService>()
            .SingleInstance();

        builder.Register(_ => new Auth.Local.LocalAuthOptions
            {
                SigningKey = "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF",
            })
            .As<Auth.Local.LocalAuthOptions>()
            .SingleInstance()
            .IfNotRegistered(typeof(Auth.Local.LocalAuthOptions));

        builder.RegisterType<Auth.Local.Internal.LocalTokenIssuer>()
            .As<Auth.Local.ILocalTokenIssuer>()
            .SingleInstance();

        builder.RegisterType<Auth.Local.Internal.InviteService>()
            .As<Auth.Local.IInviteService>()
            .SingleInstance();

        builder.RegisterType<Auth.Local.Internal.LoginService>()
            .As<Auth.Local.ILoginService>()
            .SingleInstance();

        builder.RegisterType<Auth.Local.Internal.LegacyClaimService>()
            .As<Auth.Local.ILegacyClaimService>()
            .SingleInstance();

        builder.RegisterInstance(Prompts.ResourceManager);

        builder.RegisterType<AgenticEvaluatorPresets>()
            .As<IAgenticEvaluatorPresets>()
            .SingleInstance();

        builder.RegisterType<DemoSeedContext>()
            .AsSelf()
            .SingleInstance();

        var scenarioTypes = typeof(Module).Assembly.GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false }
                        && typeof(IDemoScenario).IsAssignableFrom(t));
        foreach (var t in scenarioTypes)
        {
            builder.RegisterType(t)
                .AsSelf()
                .As<IDemoScenario>()
                .SingleInstance()
                .IfNotRegistered(t);
        }

        builder.RegisterType<DemoSeederHostedService>()
            .AsSelf()
            .SingleInstance()
            .IfNotRegistered(typeof(DemoSeederHostedService));

        const string demoSeederHostedServiceKey = "Trsr.Application.DemoSeederHostedService.Registered";
        if (!builder.Properties.ContainsKey(demoSeederHostedServiceKey))
        {
            builder.Properties[demoSeederHostedServiceKey] = true;
            builder.RegisterServiceCollection(services =>
            {
                services.AddSingleton<IHostedService>(sp =>
                {
                    var kiosk = sp.GetRequiredService<KioskOptions>();
                    if (!kiosk.Enabled)
                    {
                        return new NullHostedService();
                    }

                    return sp.GetRequiredService<DemoSeederHostedService>();
                });
            });
        }
    }
}