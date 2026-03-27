using Autofac;
using Autofac.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection;

namespace Trsr.Common.DependencyInjection;

public static class AutofacExtensions
{
    public static void RegisterServiceCollection(this ContainerBuilder builder, Action<IServiceCollection> config)
    {
        var services = new ServiceCollection();
        config(services);
        builder.Populate(services);
    }
}