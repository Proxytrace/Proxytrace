using Autofac;

namespace Trsr.Prompting.Tests;

public class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);
        builder.RegisterModule<Prompting.Module>();
    }
}