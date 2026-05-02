using Autofac;
using Trsr.Domain.ModelEndpoint;
using Trsr.Testing;

namespace Trsr.Storage.Tests;

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
        builder.RegisterModule(new Storage.Module(StorageConfiguration.InMemory()));
        builder.RegisterStub<IModelClient>();
    }
}