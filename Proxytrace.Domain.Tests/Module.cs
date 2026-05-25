using Autofac;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Storage;
using Proxytrace.Testing;

namespace Proxytrace.Domain.Tests;

public class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);
        builder.RegisterModule<Domain.Module>();
        builder.RegisterModule(new Storage.Module(_ => StorageConfiguration.InMemory()));
        builder.RegisterStub<IModelClient>();
        builder.RegisterStub<IProviderClient>();
        builder.RegisterInstance(Prompts.ResourceManager);
    }
}
