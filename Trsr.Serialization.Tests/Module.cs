using Autofac;

namespace Trsr.Serialization.Tests;

public class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);
        builder.RegisterModule<Module>();
    }
}