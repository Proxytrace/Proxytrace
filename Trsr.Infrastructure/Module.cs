using Autofac;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.ModelProvider;
using Trsr.Infrastructure.Internal;

namespace Trsr.Infrastructure;

public class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);
        builder.RegisterModule<Trsr.Domain.Module>();
        builder.RegisterModule<Trsr.Serialization.Module>();

        builder.RegisterType<ModelClient>()
            .As<IModelClient>()
            .AsSelf();

        builder.RegisterType<ProviderClient>()
            .As<IProviderClient>();
    }
}