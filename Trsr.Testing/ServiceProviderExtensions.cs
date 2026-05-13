using Microsoft.Extensions.DependencyInjection;
using Trsr.Common.Lifecycle;

namespace Trsr.Testing;

public static class ServiceProviderExtensions
{
    public static ITempDirectory GetTempDirectory(this IServiceProvider services, string? prefix = null)
    {
        var factory = services.GetRequiredService<ITempDirectory.Create>();
        return factory(prefix: prefix);
    }
}