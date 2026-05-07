namespace Trsr.Domain.Prompt;

/// <summary>
/// Repository for <see cref="IPromptTemplate"/>
/// </summary>
public interface IPromptTemplateRepository
{
    /// <summary>
    /// Gets a <see cref="IPromptTemplate"/> by its <paramref name="name"/>.
    /// </summary>
    Task<IPromptTemplate?> FindAsync(string name, CancellationToken cancellationToken = default);
}