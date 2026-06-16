using System.Net;
using System.Text;
using AwesomeAssertions;
using Proxytrace.Common.Async;
using Proxytrace.Infrastructure.Internal;

namespace Proxytrace.Infrastructure.Tests;

[TestClass]
public sealed class FrankfurterFxRateProviderTests
{
    public required TestContext TestContext { get; init; }

    [TestMethod]
    public async Task GetUsdToEur_ParsesRate()
    {
        var handler = new StubHandler(HttpStatusCode.OK,
            """{"amount":1.0,"base":"USD","date":"2026-06-09","rates":{"EUR":0.92}}""");
        var sut = new FrankfurterFxRateProvider(new HttpClient(handler), new PricingOptions(), new NoOpAsyncLock());

        var rate = await sut.GetUsdToEurAsync(TestContext.CancellationToken);

        rate.Should().Be(0.92m);
    }

    [TestMethod]
    public async Task GetUsdToEur_OnFailure_ReturnsNull()
    {
        var handler = new StubHandler(HttpStatusCode.InternalServerError, "boom");
        var sut = new FrankfurterFxRateProvider(new HttpClient(handler), new PricingOptions(), new NoOpAsyncLock());

        (await sut.GetUsdToEurAsync(TestContext.CancellationToken)).Should().BeNull();
    }

    private sealed class NoOpAsyncLock : IAsyncLock
    {
        public IDisposable Lock(object key) => new Handle();
        public Task<IDisposable> LockAsync(object key, CancellationToken cancellationToken = default) =>
            Task.FromResult<IDisposable>(new Handle());

        private sealed class Handle : IDisposable
        {
            public void Dispose() { }
        }
    }

    private sealed class StubHandler(HttpStatusCode status, string body) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) =>
            Task.FromResult(new HttpResponseMessage(status)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            });
    }
}
