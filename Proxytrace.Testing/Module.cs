using Autofac;
using Autofac.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using NSubstitute;
using Proxytrace.Common.DependencyInjection;
using Proxytrace.Common.Lifecycle;

namespace Proxytrace.Testing;

internal class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);
        builder
            .Register(sp => new AutofacServiceProvider(sp.Resolve<ILifetimeScope>()))
            .As<IServiceProvider>();
        
        builder.Register(c =>
        {
            var dir = c.Resolve<ITempDirectory.Create>()();
            var env = Substitute.For<IHostEnvironment>();
            env.ContentRootPath.Returns(dir.Path);
            return env;
        }).SingleInstance();

        builder.RegisterServiceCollection(sc => sc.AddLogging());
    }
}