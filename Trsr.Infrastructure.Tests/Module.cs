using Autofac;

namespace Trsr.Infrastructure.Tests;

public class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);
        builder.RegisterModule<Infrastructure.Module>();
    }
}