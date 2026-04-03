using Autofac;
using Microsoft.Extensions.Logging.Abstractions;
using Trsr.Api.Services;
using Trsr.Api.Services.Internal;
using Trsr.Storage;

namespace Trsr.Api.Tests;

/// <summary>
/// Dependency injection module for API tests.
/// Wires TestRunnerService with in-memory storage and a stub IHttpClientFactory.
/// The factory is registered as a named constant so per-test overrides work cleanly.
/// </summary>
public sealed class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

        builder.RegisterModule(new Storage.Module(StorageConfiguration.InMemory()));

        builder.RegisterType<OpenAiCallParser>()
            .As<IOpenAiCallParser>()
            .SingleInstance();

        builder.RegisterType<TestRunnerService>()
            .As<ITestRunnerService>()
            .InstancePerDependency();

        builder
            .Register(_ => NullLogger<TestRunnerService>.Instance)
            .As<Microsoft.Extensions.Logging.ILogger<TestRunnerService>>()
            .SingleInstance();

        // Register a default stub factory — tests override this via GetServices(action).
        builder
            .Register(_ => new FakeHttpClientFactory(FakeHttpMessageHandler.BuildOpenAiResponse("")))
            .As<IHttpClientFactory>()
            .SingleInstance();
    }
}
