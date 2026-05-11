using Autofac;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Trsr.Application.Ingestion.Internal;
using Trsr.Application.TestRun;
using Trsr.Application.TestRun.Internal;
using Trsr.Domain.Agent;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;
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
        builder.RegisterModule<Trsr.Serialization.Module>();

        builder.RegisterStub<IModelClient>();
        builder.RegisterStub<IProviderClient>();

        builder.RegisterStub<IAgentNameGenerator>(stub =>
            stub.GenerateNameAsync(Arg.Any<IPromptTemplate>(), Arg.Any<IProject>(), Arg.Any<CancellationToken>())
                .ReturnsForAnyArgs(Task.FromResult("Test Agent")));

        builder.RegisterInstance(new TestRunnerConfiguration())
            .As<TestRunnerConfiguration>()
            .SingleInstance();

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

        builder.RegisterInstance(new Trsr.Application.Auth.Local.LocalAuthOptions
        {
            SigningKey = "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF",
            Issuer = "trsr-local",
            Audience = "trsr-api",
            TokenLifetime = TimeSpan.FromDays(7),
        });
    }
}
