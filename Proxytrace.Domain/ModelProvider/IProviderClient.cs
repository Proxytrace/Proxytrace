using Proxytrace.Domain.Model;

namespace Proxytrace.Domain.ModelProvider;

public interface IProviderClient
{
    public delegate IProviderClient Factory(IModelProvider provider);
    
    Task<bool> VerifyConnectionAsync(CancellationToken cancellationToken = default);
    
    Task<IReadOnlyList<IModel>> GetModelsAsync(CancellationToken cancellationToken = default);
}