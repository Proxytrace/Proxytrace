using Autofac;
using Proxytrace.Application.Playground.Internal;

namespace Proxytrace.Application.Playground;

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
