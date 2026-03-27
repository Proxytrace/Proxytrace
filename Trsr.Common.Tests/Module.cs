using Autofac;

namespace Trsr.Common.Tests;

public class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);
        builder.RegisterModule<Common.Module>();
    }
}