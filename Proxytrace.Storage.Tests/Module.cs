using Autofac;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Testing;

namespace Proxytrace.Storage.Tests;

/// <summary>
/// Dependency injection module
/// </summary>
public class Module : Autofac.Module
{
    /// <summary>
    /// Add the services for storage tests
    /// </summary>
    protected override void Load(ContainerBuilder builder)
    {
        builder.RegisterModule(new Storage.Module(_ => StorageConfiguration.InMemory()));
        builder.RegisterStub<IModelClient>();
        builder.RegisterStub<IProviderClient>();
    }
}