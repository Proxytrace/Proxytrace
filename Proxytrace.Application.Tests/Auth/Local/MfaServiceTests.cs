using System.Data.Common;
using Autofac;
using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using OtpNet;
using Proxytrace.Application.Auth;
using Proxytrace.Application.Auth.Local;
using Proxytrace.Domain;
using Proxytrace.Domain.MfaBackupCode;
using Proxytrace.Domain.User;
using Proxytrace.Domain.UserTotpEnrollment;
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
    public async Task Setup_CalledTwiceBeforeActivation_ReplacesPendingEnrollment()
    {
        var services = GetServices();
        var user = await SeedUser(services);
        var mfa = services.GetRequiredService<IMfaService>();

        var first = await mfa.SetupAsync(user, CancellationToken);
        var second = await mfa.SetupAsync(user, CancellationToken);

        first.Should().NotBeNull();
        second.Should().NotBeNull();
        second!.Secret.Should().NotBe(first!.Secret);

        // The replaced pending enrollment is gone; the latest secret is the one that activates.
        (await mfa.IsEnabledAsync(user.Id, CancellationToken)).Should().BeFalse();
        var codes = await mfa.ActivateAsync(user, ComputeCode(second.Secret), CancellationToken);
        codes.Should().NotBeNull();
    }

    /// <summary>
    /// Two near-simultaneous setups (e.g. a double-submitted request) race on the per-user unique
    /// index. The loser's insert violates IX_UserTotpEnrollmentEntity_User; rather than surfacing a
    /// 500 it must return the enrollment that actually landed so the user scans a secret that verifies.
    /// The EF in-memory provider does not enforce unique indexes, so the violation is simulated.
    /// </summary>
    [TestMethod]
    public async Task Setup_WhenConcurrentSetupWinsTheUniqueRace_ReturnsTheEnrollmentThatLanded()
    {
        const string winnerSecret = "JBSWY3DPEHPK3PXP";
        var enrollments = Substitute.For<IUserTotpEnrollmentRepository>();

        var services = GetServices(builder =>
            builder.RegisterInstance(enrollments)
                .As<IUserTotpEnrollmentRepository>()
                .As<IRepository<IUserTotpEnrollment>>());

        var user = await SeedUser(services);
        var winner = services.GetRequiredService<IUserTotpEnrollment.CreateNew>()(user, winnerSecret);

        // No enrollment when we first read; the concurrent winner's pending row once we re-read.
        enrollments.FindByUserAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IUserTotpEnrollment?>(null), Task.FromResult<IUserTotpEnrollment?>(winner));
        // Our own insert loses the race against the per-user unique index.
        enrollments.AddAsync(Arg.Any<IUserTotpEnrollment>(), Arg.Any<CancellationToken>())
            .Throws(new Exception("save failed", new FakeUniqueViolation()));

        var mfa = services.GetRequiredService<IMfaService>();

        var setup = await mfa.SetupAsync(user, CancellationToken);

        setup.Should().NotBeNull();
        setup!.Secret.Should().Be(winnerSecret);
    }

    /// <summary>A <see cref="DbException"/> carrying PostgreSQL SQLSTATE 23505 (unique_violation).</summary>
    private sealed class FakeUniqueViolation : DbException
    {
        public FakeUniqueViolation() : base("duplicate key value violates unique constraint") { }

        public override string SqlState => "23505";
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
