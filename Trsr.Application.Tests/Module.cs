using Autofac;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Trsr.Application.Ingestion.Internal;
using Trsr.Application.TestRun.Internal;
using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Storage;
using Trsr.Testing;

namespace Trsr.Application.Tests;

public class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);
        builder.RegisterModule<Domain.Module>();
        builder.RegisterModule(new Storage.Module(StorageConfiguration.InMemory()));

        builder.RegisterStub<IModelClient>();

        builder.RegisterStub<IAgentNameGenerator>(stub =>
            stub.GenerateNameAsync(Arg.Any<SystemMessage>(), Arg.Any<IModelEndpoint>(), Arg.Any<CancellationToken>())
                .ReturnsForAnyArgs(Task.FromResult("Test Agent")));

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
            .AsSelf()
            .AsImplementedInterfaces()
            .SingleInstance();

        builder
            .Register(_ => NullLogger<AgentCallIngestor>.Instance)
            .As<Microsoft.Extensions.Logging.ILogger<AgentCallIngestor>>()
            .SingleInstance();
    }
}
