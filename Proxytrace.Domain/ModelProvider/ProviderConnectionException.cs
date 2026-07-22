namespace Proxytrace.Domain.ModelProvider;

public sealed class ProviderConnectionException : Exception
{
    public ProviderConnectionException(ProviderConnectionError error, Exception innerException)
        : base($"Provider connection failed: {error}", innerException)
    {
        Error = error;
    }

    public ProviderConnectionError Error { get; }
}
