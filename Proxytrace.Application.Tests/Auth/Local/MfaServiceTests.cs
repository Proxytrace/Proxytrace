using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using OtpNet;
using Proxytrace.Application.Auth;
using Proxytrace.Application.Auth.Local;
using Proxytrace.Domain.MfaBackupCode;
using Proxytrace.Domain.User;
using Proxytrace.Testing;

namespace Proxytrace.Application.Tests.Auth.Local;

[TestClass]
public sealed class MfaServiceTests : BaseTest<Module>
{
    private const string Password = "Abcdef1!";

    private async Task<IUser> SeedUser(IServiceProvider services, string email = "u@b.com")
    {
        var pwd = services.GetRequiredService<IPasswordService>();
        var factory = services.GetRequiredService<IUser.CreateNew>();
        var hash = pwd.Hash(factory(email, null, "x", UserRole.Member), Password);
        return await factory(email, null, hash, UserRole.Member).AddAsync(CancellationToken);
    }

    private static string ComputeCode(string secret)
        => new Totp(Base32Encoding.ToBytes(secret)).ComputeTotp();

    /// <summary>Runs setup + activate and returns the secret and the issued backup codes.</summary>
    private async Task<(string Secret, IReadOnlyList<string> BackupCodes)> EnableMfa(IServiceProvider services, IUser user)
    {
        var mfa = services.GetRequiredService<IMfaService>();
        var setup = await mfa.SetupAsync(user, CancellationToken);
        setup.Should().NotBeNull();
        var codes = await mfa.ActivateAsync(user, ComputeCode(setup!.Secret), CancellationToken);
        codes.Should().NotBeNull();
        return (setup.Secret, codes!);
    }

    [TestMethod]
    public async Task Setup_ThenActivate_EnablesMfaAndReturnsTenBackupCodes()
    {
        var services = GetServices();
        var user = await SeedUser(services);
        var mfa = services.GetRequiredService<IMfaService>();

        var (_, codes) = await EnableMfa(services, user);

        codes.Should().HaveCount(10);
        codes.Should().OnlyHaveUniqueItems();
        (await mfa.IsEnabledAsync(user.Id, CancellationToken)).Should().BeTrue();
    }

    [TestMethod]
    public async Task Activate_WithWrongCode_ReturnsNullAndStaysDisabled()
    {
        var services = GetServices();
        var user = await SeedUser(services);
        var mfa = services.GetRequiredService<IMfaService>();
        await mfa.SetupAsync(user, CancellationToken);

        (await mfa.ActivateAsync(user, "000000", CancellationToken)).Should().BeNull();
        (await mfa.IsEnabledAsync(user.Id, CancellationToken)).Should().BeFalse();
    }

    [TestMethod]
    public async Task Setup_WhenAlreadyEnabled_ReturnsNull()
    {
        var services = GetServices();
        var user = await SeedUser(services);
        var mfa = services.GetRequiredService<IMfaService>();
        await EnableMfa(services, user);

        (await mfa.SetupAsync(user, CancellationToken)).Should().BeNull();
    }

    [TestMethod]
    public async Task VerifyChallenge_WithBackupCode_IssuesSessionAndConsumesCode()
    {
        var services = GetServices();
        var user = await SeedUser(services);
        var mfa = services.GetRequiredService<IMfaService>();
        var challenges = services.GetRequiredService<IMfaChallengeService>();
        var (_, codes) = await EnableMfa(services, user);

        var challenge = challenges.Issue(user);
        var result = await mfa.VerifyChallengeAsync(challenge.Token, codes[0], CancellationToken);
        result.Should().NotBeNull();
        result!.Token.Should().NotBeNullOrEmpty();

        // The same backup code cannot be reused, even with a fresh challenge.
        var second = challenges.Issue(user);
        (await mfa.VerifyChallengeAsync(second.Token, codes[0], CancellationToken)).Should().BeNull();
    }

    [TestMethod]
    public async Task VerifyChallenge_WithUnknownToken_ReturnsNull()
    {
        var services = GetServices();
        var user = await SeedUser(services);
        var mfa = services.GetRequiredService<IMfaService>();
        var (_, codes) = await EnableMfa(services, user);

        (await mfa.VerifyChallengeAsync("not-a-real-ticket", codes[0], CancellationToken)).Should().BeNull();
    }

    [TestMethod]
    public async Task Disable_WithWrongPassword_ReturnsNullAndKeepsMfa()
    {
        var services = GetServices();
        var user = await SeedUser(services);
        var mfa = services.GetRequiredService<IMfaService>();
        await EnableMfa(services, user);

        (await mfa.DisableAsync(user, "Wrong!1A", CancellationToken)).Should().BeNull();
        (await mfa.IsEnabledAsync(user.Id, CancellationToken)).Should().BeTrue();
    }

    [TestMethod]
    public async Task Disable_WithCorrectPassword_RemovesEnrollmentAndBackupCodes()
    {
        var services = GetServices();
        var user = await SeedUser(services);
        var mfa = services.GetRequiredService<IMfaService>();
        await EnableMfa(services, user);

        (await mfa.DisableAsync(user, Password, CancellationToken)).Should().Be(true);

        (await mfa.IsEnabledAsync(user.Id, CancellationToken)).Should().BeFalse();
        var remaining = await services.GetRequiredService<IMfaBackupCodeRepository>().ListByUserAsync(user.Id, CancellationToken);
        remaining.Should().BeEmpty();
    }

    [TestMethod]
    public async Task AdminDisable_RemovesEnrollmentWithoutPassword()
    {
        var services = GetServices();
        var user = await SeedUser(services);
        var mfa = services.GetRequiredService<IMfaService>();
        await EnableMfa(services, user);

        (await mfa.AdminDisableAsync(user.Id, CancellationToken)).Should().BeTrue();
        (await mfa.IsEnabledAsync(user.Id, CancellationToken)).Should().BeFalse();
    }

    [TestMethod]
    public async Task Login_WhenMfaEnabled_ReturnsMfaRequired()
    {
        var services = GetServices();
        var user = await SeedUser(services);
        await EnableMfa(services, user);

        var outcome = await services.GetRequiredService<ILoginService>().LoginAsync("u@b.com", Password, CancellationToken);

        outcome.Should().BeOfType<MfaRequired>();
        ((MfaRequired)outcome!).ChallengeToken.Should().NotBeNullOrEmpty();
    }
}
