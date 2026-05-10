using Autofac;
using Trsr.Application.Playground.Internal;

namespace Trsr.Application.Playground;

internal sealed class PlaygroundModule : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

        builder.RegisterType<PlaygroundService>()
            .As<IPlaygroundService>()
            .SingleInstance();
    }
}
