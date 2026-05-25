using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Application.Auth;
using Proxytrace.Domain.User;
using Proxytrace.Testing;

namespace Proxytrace.Application.Tests.Auth;

[TestClass]
public sealed class JitUserProvisionerTests : BaseTest<Module>
{
    [TestMethod]
    public async Task EnsureProvisioned_FirstUser_IsCreatedAsAdmin()
    {
        IServiceProvider services = GetServices();
        var provisioner = services.GetRequiredService<IJitUserProvisioner>();

        var user = await provisioner.EnsureProvisionedAsync("ext-001", "first@example.com", CancellationToken);

        user.Role.Should().Be(UserRole.Admin);
        user.Email.Should().Be("first@example.com");
    }

    [TestMethod]
    public async Task EnsureProvisioned_SecondUser_IsCreatedAsViewer()
    {
        IServiceProvider services = GetServices();
        var provisioner = services.GetRequiredService<IJitUserProvisioner>();

        await provisioner.EnsureProvisionedAsync("ext-001", "first@example.com", CancellationToken);
        var second = await provisioner.EnsureProvisionedAsync("ext-002", "second@example.com", CancellationToken);

        second.Role.Should().Be(UserRole.Viewer);
    }

    [TestMethod]
    public async Task EnsureProvisioned_SameSubjectTwice_ReturnsSameUser()
    {
        IServiceProvider services = GetServices();
        var provisioner = services.GetRequiredService<IJitUserProvisioner>();

        var first = await provisioner.EnsureProvisionedAsync("ext-001", "first@example.com", CancellationToken);
        var second = await provisioner.EnsureProvisionedAsync("ext-001", "first@example.com", CancellationToken);

        second.Id.Should().Be(first.Id);
    }

    [TestMethod]
    public async Task EnsureProvisioned_SameSubject_IgnoresChangedEmailOnSubsequent()
    {
        IServiceProvider services = GetServices();
        var provisioner = services.GetRequiredService<IJitUserProvisioner>();

        var first = await provisioner.EnsureProvisionedAsync("ext-001", "first@example.com", CancellationToken);
        var second = await provisioner.EnsureProvisionedAsync("ext-001", "renamed@example.com", CancellationToken);

        second.Id.Should().Be(first.Id);
        second.Email.Should().Be("first@example.com");
    }

    [TestMethod]
    public async Task EnsureProvisioned_TwoSubjects_BothPersisted()
    {
        IServiceProvider services = GetServices();
        var provisioner = services.GetRequiredService<IJitUserProvisioner>();
        var repo = services.GetRequiredService<IUserRepository>();

        await provisioner.EnsureProvisionedAsync("ext-001", "a@example.com", CancellationToken);
        await provisioner.EnsureProvisionedAsync("ext-002", "b@example.com", CancellationToken);

        var count = await repo.CountAsync(CancellationToken);
        count.Should().Be(2);
    }
}
