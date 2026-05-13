using Autofac;
using Trsr.Application.Demo;
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

        builder.RegisterType<KioskModelClient>()
            .AsSelf();
        builder.RegisterType<ModelClient>()
            .AsSelf();

        builder.Register<IModelClient>(c =>
        {
            KioskOptions kiosk = c.Resolve<KioskOptions>();
            if (kiosk.Enabled)
            {
                return c.Resolve<KioskModelClient>();
            }

            return c.Resolve<ModelClient>();
        }).As<IModelClient>();

        builder.RegisterType<ProviderClient>()
            .As<IProviderClient>();
    }
}