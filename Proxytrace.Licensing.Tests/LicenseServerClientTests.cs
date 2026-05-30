using System.Net;
using AwesomeAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Proxytrace.Licensing.Internal;

namespace Proxytrace.Licensing.Tests;

[TestClass]
public sealed class LicenseServerClientTests
{
    private readonly MutableClock clock = new(new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero));

    private LicenseServerClient Create(StubHttpMessageHandler handler)
    {
        var httpClient = new HttpClient(handler) { BaseAddress = new Uri("https://license.proxytrace.dev/") };
        return new LicenseServerClient(httpClient, clock, NullLogger<LicenseServerClient>.Instance);
    }

    [TestMethod]
    public async Task CheckAsync_ValidResponse_ParsesStatus()
    {
        var handler = new StubHttpMessageHandler(
            HttpStatusCode.OK,
            "{\"status\":\"valid\",\"updatedTier\":\"Enterprise\",\"updatedLimits\":{\"MaxUsers\":42}}");

        var result = await Create(handler).CheckAsync("jti-1", "1.0.0", CancellationToken.None);

        result.Status.Should().Be(LicenseCheckResult.Valid);
        result.UpdatedTier.Should().Be(LicenseTier.Enterprise);
        result.UpdatedLimits.Should().ContainKey(LicenseLimit.MaxUsers);
        result.UpdatedLimits![LicenseLimit.MaxUsers].Should().Be(42);
        handler.LastRequestUri!.AbsolutePath.Should().Be("/licenses/check");
    }

    [TestMethod]
    public async Task CheckAsync_RevokedResponse_ParsesRevoked()
    {
        var handler = new StubHttpMessageHandler(HttpStatusCode.OK, "{\"status\":\"revoked\"}");

        var result = await Create(handler).CheckAsync("jti-1", "1.0.0", CancellationToken.None);

        result.Status.Should().Be(LicenseCheckResult.Revoked);
    }

    [TestMethod]
    public async Task CheckAsync_ServerError_ReturnsUnknownTransient()
    {
        var handler = new StubHttpMessageHandler(HttpStatusCode.InternalServerError, "{}");

        var result = await Create(handler).CheckAsync("jti-1", "1.0.0", CancellationToken.None);

        result.Status.Should().Be(LicenseCheckResult.Unknown);
    }

    [TestMethod]
    public async Task CheckAsync_TransportFailure_ReturnsUnknownTransient()
    {
        var result = await Create(StubHttpMessageHandler.Faulting())
            .CheckAsync("jti-1", "1.0.0", CancellationToken.None);

        result.Status.Should().Be(LicenseCheckResult.Unknown);
    }
}
