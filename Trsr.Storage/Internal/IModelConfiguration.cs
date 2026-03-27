using Microsoft.EntityFrameworkCore;

namespace Trsr.Storage.Internal;

/// <summary>
/// Model configuration for Entity Framework Core
/// </summary>
internal interface IModelConfiguration
{
    /// <summary>
    /// Configures the model using the provided builder
    /// </summary>
    void CreateModel(ModelBuilder builder);
}