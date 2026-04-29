using Autofac;
using Autofac.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Common.DependencyInjection;

namespace Trsr.Testing;

internal class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);
        builder
            .Register(sp => new AutofacServiceProvider(sp.Resolve<ILifetimeScope>()))
            .As<IServiceProvider>();

        builder.RegisterServiceCollection(sc => sc.AddLogging());
    }
}