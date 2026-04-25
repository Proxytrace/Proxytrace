namespace Trsr.Domain.Model;

/// <summary>
/// Model definition
/// </summary>
public interface IModel : IDomainEntity
{
    /// <summary>
    /// The name of the model (e.g. "claude-sonnet-4.5 ")
    /// </summary>
    string Name { get; }
}