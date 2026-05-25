using Autofac;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Proxytrace.Application.Ingestion.Internal;
using Proxytrace.Application.TestRun;
using Proxytrace.Application.TestRun.Internal;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.Prompt;
using Proxytrace.Storage;
using Proxytrace.Testing;

namespace Proxytrace.Application.Tests;

public class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);
        builder.RegisterModule<Domain.Module>();
        builder.RegisterModule(new Storage.Module(_ => StorageConfiguration.InMemory()));
        builder.RegisterModule<Proxytrace.Serialization.Module>();

        builder.RegisterStub<IModelClient>();
        builder.RegisterStub<IProviderClient>();
        builder.RegisterStub<Proxytrace.Application.Auth.ICurrentUserAccessor>();

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

        builder.RegisterInstance(new Proxytrace.Application.Auth.Local.LocalAuthOptions
        {
            SigningKey = "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF",
            Issuer = "proxytrace-local",
            Audience = "proxytrace-api",
            TokenLifetime = TimeSpan.FromDays(7),
        });
    }
}
