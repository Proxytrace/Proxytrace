using Autofac;
using Trsr.Application.Auth;
using Trsr.Domain.Agent;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.ModelProvider;
using Trsr.Domain.Project;
using Trsr.Domain.Prompt;
using Trsr.Domain.User;
using Trsr.Storage;
using Trsr.Testing;

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
            IPromptTemplate systemPrompt,
            IProject project,
            CancellationToken cancellationToken = default)
            => Task.FromResult<string>("Test Agent");
    }

    private sealed class StubCurrentUserAccessor : ICurrentUserAccessor
    {
        public Task<IUser?> GetCurrentUserAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IUser?>(null);
    }

    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

        builder.RegisterModule<Api.Module>();
        builder.RegisterModule(new Storage.Module(_ => StorageConfiguration.InMemory()));
        builder.RegisterStub<IModelClient>();
        builder.RegisterStub<IProviderClient>();

        builder.RegisterInstance<IAgentNameGenerator>(new StubAgentNameGenerator())
            .SingleInstance();

        builder.RegisterInstance<ICurrentUserAccessor>(new StubCurrentUserAccessor())
            .SingleInstance();

        // Register a default stub factory — tests override this via GetServices(action).
        builder
            .Register(_ => new FakeHttpClientFactory(FakeHttpMessageHandler.BuildOpenAiResponse("")))
            .As<IHttpClientFactory>()
            .SingleInstance();
    }
}
