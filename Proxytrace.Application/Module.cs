using Autofac;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Proxytrace.Application.Agent;
using Proxytrace.Application.Auth;
using Proxytrace.Application.Auth.Internal;
using Proxytrace.Application.Cleanup;
using Proxytrace.Application.Cleanup.Internal;
using Proxytrace.Application.Demo;
using Proxytrace.Application.Demo.Internal;
using Proxytrace.Application.Evaluator;
using Proxytrace.Application.Evaluator.Internal;
using Proxytrace.Application.Setup;
using Proxytrace.Application.Setup.Internal;
using Proxytrace.Application.Ingestion.Internal;
using Proxytrace.Application.Search;
using Proxytrace.Application.Streaming;
using Proxytrace.Application.Streaming.Internal;
using Proxytrace.Application.TestRun.Internal;
using Proxytrace.Common.DependencyInjection;
using Proxytrace.Common.Hosting;
using Proxytrace.Domain.Agent;

namespace Proxytrace.Application;

public sealed class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

        // Licensing. A composition root (e.g. the API) registers the Licensing module itself with
        // an environment-derived configuration before this module loads (setting the key below);
        // otherwise fall back to the Free-tier default used by tests and the in-process kiosk.
        const string licensingModuleKey = "Proxytrace.Licensing.Registered";
        if (!builder.Properties.ContainsKey(licensingModuleKey))
        {
            builder.Properties[licensingModuleKey] = true;
            builder.RegisterModule(new Proxytrace.Licensing.Module(new Proxytrace.Licensing.LicensingConfiguration
            {
                ServerUrl = "https://license.proxytrace.dev",
                PublicKeys = Proxytrace.Licensing.LicensePublicKeys.GetActiveKeys(),
                LicenseJwt = null,
                CacheFilePath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "proxytrace-license-cache.json"),
            }));
        }

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

        const string testRunnerHostedServiceKey = "Proxytrace.Application.TestRunnerService.Registered";
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

        builder.RegisterType<AgentVersionMatcher>()
            .As<IAgentVersionMatcher>()
            .SingleInstance();

        builder.Register(_ => new AgentVersioningOptions())
            .As<AgentVersioningOptions>()
            .SingleInstance()
            .IfNotRegistered(typeof(AgentVersioningOptions));

        // Ingestion transport. A host running the proxy/app split registers the Redis-backed
        // Messaging module itself (and sets this key) before this module loads; otherwise fall
        // back to the in-process stream used by the test suite and single-process runs.
        const string messagingModuleKey = "Proxytrace.Messaging.Registered";
        if (!builder.Properties.ContainsKey(messagingModuleKey))
        {
            builder.Properties[messagingModuleKey] = true;
            builder.RegisterModule(new Proxytrace.Messaging.Module());
        }

        builder.RegisterType<TraceQuotaGuard>()
            .As<Ingestion.ITraceQuotaGuard>()
            .AsSelf()
            .SingleInstance()
            .IfNotRegistered(typeof(TraceQuotaGuard));

        const string traceQuotaGuardKey = "Proxytrace.Application.TraceQuotaGuard.Registered";
        if (!builder.Properties.ContainsKey(traceQuotaGuardKey))
        {
            builder.Properties[traceQuotaGuardKey] = true;
            builder.RegisterServiceCollection(services =>
                services.AddSingleton<IHostedService>(sc =>
                {
                    var kiosk = sc.GetRequiredService<KioskOptions>();
                    return kiosk.Enabled
                        ? new NullHostedService()
                        : sc.GetRequiredService<TraceQuotaGuard>();
                }));
        }

        builder.RegisterType<AgentCallProcessor>()
            .As<IAgentCallProcessor>()
            .AsSelf()
            .SingleInstance()
            .IfNotRegistered(typeof(AgentCallProcessor));

        builder.RegisterType<AgentCallIngestionWorker>()
            .AsSelf()
            .SingleInstance()
            .IfNotRegistered(typeof(AgentCallIngestionWorker));

        const string agentCallIngestionWorkerKey = "Proxytrace.Application.AgentCallIngestionWorker.Registered";
        if (!builder.Properties.ContainsKey(agentCallIngestionWorkerKey))
        {
            builder.Properties[agentCallIngestionWorkerKey] = true;
            builder.RegisterServiceCollection(services =>
            {
                services.AddSingleton<IHostedService>(sc =>
                {
                    var kiosk = sc.GetRequiredService<KioskOptions>();
                    return kiosk.Enabled
                        ? new NullHostedService()
                        : sc.GetRequiredService<AgentCallIngestionWorker>();
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

        const string demoSeederHostedServiceKey = "Proxytrace.Application.DemoSeederHostedService.Registered";
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