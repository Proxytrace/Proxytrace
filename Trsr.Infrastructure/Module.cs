using Autofac;
using Trsr.Domain.ModelEndpoint;
using Trsr.Infrastructure.Internal;

namespace Trsr.Infrastructure;

public class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

        builder.RegisterType<ModelClient>()
            .As<IModelClient>();
    }
}