using Microsoft.Extensions.Hosting;
using Proxytrace.Domain.ApplicationError;

namespace Proxytrace.Application.ErrorLog.Internal;

/// <summary>
/// Consumer side of error capture: drains the <see cref="IErrorLogChannel"/> and persists each entry
/// as an <see cref="IApplicationError"/>. Failures are written to <see cref="Console.Error"/> only,
/// NEVER via <c>ILogger</c> — logging here would re-enter the capture pipeline and loop. Retention is
/// handled separately by <see cref="ErrorLogCleanupService"/>.
/// </summary>
internal sealed class ErrorLogWriter : BackgroundService
{
    private readonly IErrorLogChannel channel;
    private readonly IApplicationError.CreateNew createError;
    private readonly IApplicationErrorRepository repository;

    public ErrorLogWriter(
        IErrorLogChannel channel,
        IApplicationError.CreateNew createError,
        IApplicationErrorRepository repository)
    {
        this.channel = channel;
        this.createError = createError;
        this.repository = repository;
    }

    protected override async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        // Outer loop keeps the consumer alive across transient persistence failures.
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                await foreach (ErrorLogEntry entry in channel.ReadAllAsync(cancellationToken))
                {
                    await PersistAsync(entry, cancellationToken);
                }
            }
            catch (OperationCanceledException)
            {
                return; // graceful shutdown
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[ErrorLogWriter] consumer loop failed; retrying shortly: {ex}");
                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    return;
                }
            }
        }
    }

    private async Task PersistAsync(ErrorLogEntry entry, CancellationToken cancellationToken)
    {
        try
        {
            IApplicationError error = createError(
                entry.Message,
                entry.Level,
                entry.Category,
                entry.ExceptionType,
                entry.StackTrace);
            await repository.AddAsync(error, cancellationToken);
        }
        catch (Exception ex)
        {
            // Console only — see class remarks (logging here would re-enter capture and loop).
            Console.Error.WriteLine($"[ErrorLogWriter] failed to persist captured error: {ex}");
        }
    }
}
