using Microsoft.Extensions.AI;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Application.Ai;

/// <summary>
/// Creates an <see cref="IChatClient"/> configured for the given <see cref="IModelEndpoint"/>.
/// </summary>
public interface IAiClientFactory
{
    IChatClient CreateClient(IModelEndpoint endpoint);
}
