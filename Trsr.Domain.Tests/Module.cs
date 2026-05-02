using Autofac;
using Trsr.Domain.ModelEndpoint;
using Trsr.Storage;
using Trsr.Testing;

namespace Trsr.Domain.Tests;

public class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);
        builder.RegisterModule<Domain.Module>();
        builder.RegisterModule(new Storage.Module(StorageConfiguration.InMemory()));
        builder.RegisterStub<IModelClient>();
    }
}
