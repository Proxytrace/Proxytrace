using Microsoft.Extensions.Logging;

namespace Proxytrace.Application.ErrorLog.Internal;

/// <summary>
/// Registers the <see cref="ErrorLogChannelLogger"/> with the logging pipeline so every category's
/// Error/Critical entries are captured into the <see cref="IErrorLogChannel"/>.
/// </summary>
internal sealed class ErrorLogChannelLoggerProvider : ILoggerProvider
{
    private readonly IErrorLogChannel channel;

    public ErrorLogChannelLoggerProvider(IErrorLogChannel channel)
    {
        this.channel = channel;
    }

    public ILogger CreateLogger(string categoryName) => new ErrorLogChannelLogger(categoryName, channel);

    public void Dispose()
    {
    }
}
