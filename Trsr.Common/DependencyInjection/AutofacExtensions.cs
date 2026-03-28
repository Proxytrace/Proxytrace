using System.Reflection;
using Autofac;
using Autofac.Builder;
using Autofac.Extensions.DependencyInjection;
using Autofac.Features.Scanning;
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

    public static IRegistrationBuilder<object, ScanningActivatorData, DynamicRegistrationStyle> RegisterAllGeneric(
        this ContainerBuilder builder,
        Type type,
        Assembly assembly)
    {
        // register all types that implement JsonConverter<>
        return builder.RegisterAssemblyTypes(assembly)
            .Where(t => t.GetInterfaces().Any(i =>
                i.IsGenericType && i.GetGenericTypeDefinition() == type))
            .AsImplementedInterfaces();
    }
}