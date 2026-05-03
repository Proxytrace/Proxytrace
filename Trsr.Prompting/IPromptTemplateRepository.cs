namespace Trsr.Prompting;

/// <summary>
/// Repository for <see cref="IPromptTemplate"/>
/// </summary>
public interface IPromptTemplateRepository
{
    /// <summary>
    /// Gets a <see cref="IPromptTemplate"/> by its <paramref name="name"/>.
    /// </summary>
    Task<IPromptTemplate?> GetAsync(string name, CancellationToken cancellationToken = default);
}