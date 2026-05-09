using Trsr.Domain.Model;

namespace Trsr.Domain.ModelProvider;

public interface IProviderClient
{
    public delegate IProviderClient Factory(IModelProvider provider);
    
    Task<bool> VerifyConnectionAsync(CancellationToken cancellationToken = default);
    
    Task<IReadOnlyList<IModel>> GetModelsAsync(CancellationToken cancellationToken = default);
}