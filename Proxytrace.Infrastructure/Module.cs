using Autofac;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.ModelProvider;
using Proxytrace.Infrastructure.Internal;

namespace Proxytrace.Infrastructure;

public class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);
        builder.RegisterModule<Proxytrace.Domain.Module>();
        builder.RegisterModule<Proxytrace.Serialization.Module>();

        builder.RegisterType<ModelClient>()
            .As<IModelClient>()
            .AsSelf();

        builder.RegisterType<ProviderClient>()
            .As<IProviderClient>();
    }
}