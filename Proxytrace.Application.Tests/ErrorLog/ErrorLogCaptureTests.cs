using AwesomeAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Proxytrace.Application.ErrorLog;
using Proxytrace.Application.ErrorLog.Internal;
using Proxytrace.Domain.ApplicationError;
using Proxytrace.Testing;

namespace Proxytrace.Application.Tests.ErrorLog;

[TestClass]
public sealed class ErrorLogCaptureTests : BaseTest<Module>
{
    [TestMethod]
    public async Task Logger_LogError_EnqueuesEntryWithExceptionDetails()
    {
        var channel = new ErrorLogChannel();
        ILogger logger = new ErrorLogChannelLogger("Proxytrace.Some.Service", channel);

        logger.LogError(new InvalidOperationException("bang"), "it broke");

        var entries = await DrainAsync(channel);

        entries.Should().ContainSingle();
        entries[0].Message.Should().Be("it broke");
        entries[0].Level.Should().Be(ApplicationErrorLevel.Error);
        entries[0].Category.Should().Be("Proxytrace.Some.Service");
        entries[0].ExceptionType.Should().Be("System.InvalidOperationException");
        entries[0].StackTrace.Should().Contain("InvalidOperationException");
    }

    [TestMethod]
    public async Task Logger_LogCritical_MapsToCriticalLevel()
    {
        var channel = new ErrorLogChannel();
        ILogger logger = new ErrorLogChannelLogger("Cat", channel);

        logger.LogCritical("meltdown");

        var entries = await DrainAsync(channel);

        entries.Should().ContainSingle();
        entries[0].Level.Should().Be(ApplicationErrorLevel.Critical);
        entries[0].ExceptionType.Should().BeNull();
        entries[0].StackTrace.Should().BeNull();
    }

    [TestMethod]
    public async Task Logger_BelowErrorLevel_DoesNotEnqueue()
    {
        var channel = new ErrorLogChannel();
        ILogger logger = new ErrorLogChannelLogger("Cat", channel);

        logger.LogInformation("just fyi");
        logger.LogWarning("heads up");

        var entries = await DrainAsync(channel);

        entries.Should().BeEmpty();
    }

    [TestMethod]
    public async Task Logger_EfCoreCategory_IsSkipped()
    {
        var channel = new ErrorLogChannel();
        ILogger logger = new ErrorLogChannelLogger("Microsoft.EntityFrameworkCore.Database.Command", channel);

        logger.LogError(new Exception("db down"), "query failed");

        var entries = await DrainAsync(channel);

        entries.Should().BeEmpty();
    }

    [TestMethod]
    public async Task Logger_OwnPipelineCategory_IsSkipped()
    {
        var channel = new ErrorLogChannel();
        ILogger logger = new ErrorLogChannelLogger("Proxytrace.Application.ErrorLog.Internal.ErrorLogWriter", channel);

        logger.LogError("recursive failure");

        var entries = await DrainAsync(channel);

        entries.Should().BeEmpty();
    }

    [TestMethod]
    public async Task Writer_DrainsChannel_AndPersistsError()
    {
        var services = GetServices();
        var channel = services.GetRequiredService<IErrorLogChannel>();
        var writer = services.GetRequiredService<ErrorLogWriter>();
        var repository = services.GetRequiredService<IApplicationErrorRepository>();

        channel.TryWrite(new ErrorLogEntry("persisted boom", ApplicationErrorLevel.Error, "Cat", "System.Exception", "stack"));

        await writer.StartAsync(CancellationToken);
        try
        {
            for (var i = 0; i < 100 && await repository.CountAsync(CancellationToken) == 0; i++)
            {
                await Task.Delay(20, CancellationToken);
            }
        }
        finally
        {
            await writer.StopAsync(CancellationToken);
        }

        var all = await repository.GetAllAsync(CancellationToken);
        all.Should().ContainSingle(e => e.Message == "persisted boom");
    }

    private async Task<List<ErrorLogEntry>> DrainAsync(IErrorLogChannel channel)
    {
        var entries = new List<ErrorLogEntry>();
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(CancellationToken);
        cts.CancelAfter(TimeSpan.FromMilliseconds(100));
        try
        {
            await foreach (var entry in channel.ReadAllAsync(cts.Token))
            {
                entries.Add(entry);
            }
        }
        catch (OperationCanceledException)
        {
            // expected — we drain whatever is buffered then cancel.
        }

        return entries;
    }
}
