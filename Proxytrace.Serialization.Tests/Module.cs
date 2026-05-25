using Autofac;

namespace Proxytrace.Serialization.Tests;

public class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);
        builder.RegisterModule<Serialization.Module>();
    }
}