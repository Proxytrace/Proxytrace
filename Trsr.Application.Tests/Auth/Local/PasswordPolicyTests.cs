using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Application.Auth.Local;
using Trsr.Testing;

namespace Trsr.Application.Tests.Auth.Local;

[TestClass]
public sealed class PasswordPolicyTests : BaseTest<Module>
{
    private IPasswordPolicy Policy => GetServices().GetRequiredService<IPasswordPolicy>();

    [TestMethod]
    [DataRow("Abcdef1!", true)]
    [DataRow("LongerPa55word!", true)]
    [DataRow("short1!", false)]
    [DataRow("nouppercase1!", false)]
    [DataRow("NOLOWERCASE1!", false)]
    [DataRow("NoSpecial123", false)]
    [DataRow("        ", false)]
    public void Validate_EnforcesAllRules(string password, bool expected)
    {
        Policy.Validate(password).IsValid.Should().Be(expected);
    }
}
