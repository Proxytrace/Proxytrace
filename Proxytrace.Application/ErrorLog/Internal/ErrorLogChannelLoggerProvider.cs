using Microsoft.Extensions.Logging;

namespace Proxytrace.Application.ErrorLog.Internal;

/// <summary>
/// Registers the <see cref="ErrorLogChannelLogger"/> with the logging pipeline so every category's
/// Error/Critical entries are captured into the <see cref="IErrorLogChannel"/>. Implements
/// <see cref="ISupportExternalScope"/> so captured entries can read the ambient logging scope —
/// used to pick up a caller-supplied <see cref="ErrorLogScope.ErrorIdKey"/> for deep-linking.
/// </summary>
internal sealed class ErrorLogChannelLoggerProvider : ILoggerProvider, ISupportExternalScope
{
    private readonly IErrorLogChannel channel;
    private IExternalScopeProvider? scopeProvider;

    public ErrorLogChannelLoggerProvider(IErrorLogChannel channel)
    {
        this.channel = channel;
    }

    public void SetScopeProvider(IExternalScopeProvider scopeProvider) => this.scopeProvider = scopeProvider;

    // The logger reads the scope provider lazily: the logging framework calls SetScopeProvider
    // after providers are constructed, and loggers are cached, so a snapshot at creation would be null.
    public ILogger CreateLogger(string categoryName) =>
        new ErrorLogChannelLogger(categoryName, channel, () => scopeProvider);

    public void Dispose()
    {
    }
}
