using Autofac;
using Microsoft.Extensions.Logging.Abstractions;
using Trsr.Api.Services;
using Trsr.Api.Services.Internal;
using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Storage;

namespace Trsr.Api.Tests;

/// <summary>
/// Dependency injection module for API tests.
/// Wires TestRunnerService with in-memory storage and a stub IHttpClientFactory.
/// The factory is registered as a named constant so per-test overrides work cleanly.
/// </summary>
public sealed class Module : Autofac.Module
{
    private sealed class StubAgentNameGenerator : IAgentNameGenerator
    {
        public Task<string> GenerateNameAsync(
            SystemMessage systemMessage,
            IModelEndpoint endpoint,
            CancellationToken cancellationToken = default)
            => Task.FromResult<string>("Test Agent");
    }

    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

        builder.RegisterModule(new Storage.Module(StorageConfiguration.InMemory()));

        builder.RegisterInstance<IAgentNameGenerator>(new StubAgentNameGenerator())
            .SingleInstance();

        builder.RegisterType<OpenAiCallParser>()
            .As<IOpenAiCallParser>()
            .SingleInstance();

        builder.RegisterType<AgentCallIngestionService>()
            .As<IAgentCallIngestionService>()
            .InstancePerDependency();

        builder
            .Register(_ => NullLogger<AgentCallIngestionService>.Instance)
            .As<Microsoft.Extensions.Logging.ILogger<AgentCallIngestionService>>()
            .SingleInstance();

        builder.RegisterType<AgentCallIngestionQueue>()
            .AsSelf()
            .As<IAgentCallIngestionQueue>()
            .SingleInstance();

        builder.RegisterType<AgentCallIngestionWorker>()
            .AsSelf()
            .SingleInstance();

        builder
            .Register(_ => NullLogger<AgentCallIngestionWorker>.Instance)
            .As<Microsoft.Extensions.Logging.ILogger<AgentCallIngestionWorker>>()
            .SingleInstance();

        builder.RegisterType<TestRunnerService>()
            .As<ITestRunnerService>()
            .As<ITestRunExecutor>()
            .InstancePerDependency();

        builder
            .Register(_ => NullLogger<TestRunnerService>.Instance)
            .As<Microsoft.Extensions.Logging.ILogger<TestRunnerService>>()
            .SingleInstance();

        builder.RegisterType<TestRunQueue>()
            .AsSelf()
            .As<ITestRunQueue>()
            .SingleInstance();

        // Register a default stub factory — tests override this via GetServices(action).
        builder
            .Register(_ => new FakeHttpClientFactory(FakeHttpMessageHandler.BuildOpenAiResponse("")))
            .As<IHttpClientFactory>()
            .SingleInstance();
    }
}
