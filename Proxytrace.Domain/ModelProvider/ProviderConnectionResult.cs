namespace Proxytrace.Domain.ModelProvider;

public record ProviderConnectionResult(
    bool Success,
    ProviderConnectionError? Error,
    int ModelCount);
