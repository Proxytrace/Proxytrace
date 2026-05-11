using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Application.Auth.Local;
using Trsr.Domain;
using Trsr.Domain.User;
using Trsr.Testing;

namespace Trsr.Application.Tests.Auth.Local;

[TestClass]
public sealed class PasswordServiceTests : BaseTest<Module>
{
    [TestMethod]
    public async Task HashThenVerify_RoundTrips()
    {
        var services = GetServices();
        var svc = services.GetRequiredService<IPasswordService>();
        var user = await services.GetRequiredService<IDomainEntityGenerator<IUser>>().CreateAsync(CancellationToken);

        var hash = svc.Hash(user, "Abcdef1!");

        svc.Verify(user, hash, "Abcdef1!").Should().BeTrue();
        svc.Verify(user, hash, "Wrong!1A").Should().BeFalse();
    }
}
