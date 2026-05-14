using Autofac;
using Autofac.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using NSubstitute;
using Trsr.Common.DependencyInjection;
using Trsr.Common.Lifecycle;

namespace Trsr.Testing;

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