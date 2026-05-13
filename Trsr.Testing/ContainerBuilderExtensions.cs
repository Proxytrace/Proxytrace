using Autofac;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Trsr.Common.Lifecycle;

namespace Trsr.Testing;

public static class ContainerBuilderExtensions
{
    public static void RegisterStub<TService>(this ContainerBuilder builder, Action<TService>? config = null)
        where TService : class
    {
        builder.Register(_ =>
            {
                var fake = Substitute.For<TService>();
                config?.Invoke(fake);
                return fake;
            })
            .As<TService>()
            .InstancePerDependency();
    }
}