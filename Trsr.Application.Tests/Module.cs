using Autofac;
using Microsoft.Extensions.Logging.Abstractions;
using Trsr.Application.Ingestion;
using Trsr.Application.Ingestion.Internal;
using Trsr.Application.TestRun.Internal;

namespace Trsr.Application.Tests;

public class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);
        builder.RegisterType<TestRunnerService>()
            .AsImplementedInterfaces()
            .SingleInstance();

        builder
            .Register(_ => NullLogger<TestRunnerService>.Instance)
            .As<Microsoft.Extensions.Logging.ILogger<TestRunnerService>>()
            .SingleInstance();
        
        builder.RegisterType<OpenAiCallParser>()
            .As<IOpenAiCallParser>()
            .SingleInstance();

        builder.RegisterType<AgentCallIngestor>()
            .As<IAgentCallIngestor>()
            .InstancePerDependency();

        builder
            .Register(_ => NullLogger<AgentCallIngestor>.Instance)
            .As<Microsoft.Extensions.Logging.ILogger<AgentCallIngestor>>()
            .SingleInstance();

        builder.RegisterType<AgentCallIngestor>()
            .AsSelf()
            .AsImplementedInterfaces()
            .SingleInstance();

        builder
            .Register(_ => NullLogger<AgentCallIngestor>.Instance)
            .As<Microsoft.Extensions.Logging.ILogger<AgentCallIngestor>>()
            .SingleInstance();
    }
}