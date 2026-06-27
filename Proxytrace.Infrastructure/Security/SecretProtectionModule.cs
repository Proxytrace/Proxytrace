using Autofac;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Common.DependencyInjection;
using Proxytrace.Domain.Security;

namespace Proxytrace.Infrastructure.Security;

/// <summary>
/// Registers the at-rest secret seams (<see cref="ISecretProtector"/> and <see cref="ISecretHasher"/>)
/// together with the ASP.NET Core Data Protection key ring they sit on.
///
/// Shared by every host that reads or writes protected secrets — the main API host and the lean
/// ingestion proxy host — so both resolve the <em>same</em> key ring: application name "Proxytrace",
/// persisted to <c>PROXYTRACE_DATA_DIR/dataprotection-keys</c>. The proxy must decrypt the upstream
/// provider key that the API encrypted, which only works when both processes load an identical
/// key-ring configuration; keeping that configuration in one module stops the two hosts from silently
/// drifting (a mismatched application name or key path would make decryption fail at runtime). Both
/// hosts must therefore also mount the same <c>PROXYTRACE_DATA_DIR</c> volume. See <c>docs/security.md</c>.
/// </summary>
public sealed class SecretProtectionModule : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

        builder.RegisterType<Internal.DataProtectionSecretProtector>()
            .As<ISecretProtector>()
            .SingleInstance();

        builder.RegisterType<Internal.Sha256SecretHasher>()
            .As<ISecretHasher>()
            .SingleInstance();

        var dataProtectionDir = Environment.GetEnvironmentVariable("PROXYTRACE_DATA_DIR");
        builder.RegisterServiceCollection(services =>
        {
            var dataProtection = services.AddDataProtection().SetApplicationName("Proxytrace");
            if (!string.IsNullOrWhiteSpace(dataProtectionDir))
            {
                dataProtection.PersistKeysToFileSystem(
                    new DirectoryInfo(Path.Combine(dataProtectionDir, "dataprotection-keys")));
            }
        });
    }
}
