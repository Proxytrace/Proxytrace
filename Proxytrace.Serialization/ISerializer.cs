namespace Proxytrace.Serialization;

/// <summary>
/// The serializer interface
/// </summary>
public interface ISerializer
{
    /// <summary>
    /// Serializes <paramref name="input"/> to a string
    /// </summary>
    string Serialize(object? input, bool writeIndented = false);
    
    /// <summary>
    /// Parses model output to <typeparamref name="TOutput"/>
    /// </summary>
    Task<TOutput?> DeserializeAsync<TOutput>(
        string output, 
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Parses model output to <typeparamref name="TOutput"/>
    /// </summary>
    TOutput? Deserialize<TOutput>(string value);
}