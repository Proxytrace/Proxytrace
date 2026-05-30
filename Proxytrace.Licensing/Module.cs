using Autofac;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Proxytrace.Common.DependencyInjection;
using Proxytrace.Licensing.Internal;

namespace Proxytrace.Licensing;

/// <summary>
/// Autofac module wiring the licensing subsystem. The configuration (including the resolved
/// license JWT) is supplied by the composition root.
/// </summary>
public sealed class Module : Autofac.Module
{
    private readonly LicensingConfiguration configuration;

    public Module(LicensingConfiguration configuration)
    {
        this.configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
    }

    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

        builder.RegisterInstance(configuration).SingleInstance();

        builder.RegisterType<JwtLicenseValidator>()
            .As<IJwtLicenseValidator>()
            .SingleInstance();

        builder.RegisterType<LicenseCacheStore>()
            .As<ILicenseCacheStore>()
            .SingleInstance();

        // AutoActivate forces the constructor (and thus the synchronous startup gate) to run at
        // container build time. A bad JWT throws InvalidLicenseException, failing the build and
        // crashing the host non-zero — mirroring the connection-string guard.
        builder.RegisterType<LicenseService>()
            .As<ILicenseService>()
            .AsSelf()
            .SingleInstance()
            .AutoActivate();

        builder.RegisterType<LicenseCheckService>()
            .As<ILicenseRefreshTrigger>()
            .AsSelf()
            .SingleInstance();

        builder.RegisterServiceCollection(services =>
        {
            services.AddHttpClient<ILicenseServerClient, LicenseServerClient>("license-server", client =>
            {
                client.BaseAddress = new Uri(configuration.ServerUrl.TrimEnd('/') + "/");
                client.Timeout = TimeSpan.FromSeconds(30);
            });

            services.AddHostedService(sp => sp.GetRequiredService<LicenseCheckService>());
        });
    }
}
