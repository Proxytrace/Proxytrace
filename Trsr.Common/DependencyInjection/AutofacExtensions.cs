using System.Reflection;
using Autofac;
using Autofac.Builder;
using Autofac.Extensions.DependencyInjection;
using Autofac.Features.Scanning;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Common.Lifecycle;

namespace Trsr.Common.DependencyInjection;

public static class AutofacExtensions
{
    public static void RegisterServiceCollection(this ContainerBuilder builder, Action<IServiceCollection> config)
    {
        var services = new ServiceCollection();
        config(services);
        builder.Populate(services);
    }
    
    public static IReadOnlyCollection<Type> GetImplementations(
        this Type type, 
        Assembly? assembly = null)
    {
        assembly ??= type.Assembly;
        return assembly
            .GetTypes()
            .Where(t => type.IsAssignableFrom(t) && t is { IsInterface: false, IsAbstract: false })
            .ToArray();
    }

    public static void OnDispose(this ContainerBuilder builder, Action action) 
        => builder.RegisterInstance(Disposable.Create(action));
}