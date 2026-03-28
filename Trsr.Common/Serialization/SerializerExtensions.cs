using Trsr.Common.Async;

namespace Trsr.Common.Serialization;

public static class SerializerExtensions
{
    public static async ValueTask<string> SerializeAsync<T>(
        this ISerializer serializer,
        T obj, 
        CancellationToken cancellationToken = default)
    {
        await using var result = await serializer.SerializeAsync(obj, cancellationToken);
        using var reader = new StreamReader(result);
        return await reader.ReadToEndAsync(cancellationToken);
    }

    public static async ValueTask<T?> DeserializeAsync<T>(
        this ISerializer serializer, 
        string serialized,
        CancellationToken cancellationToken = default)
    {
        await using var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(serialized));
        return await serializer.DeserializeAsync<T>(stream, cancellationToken);
    }

    public static string Serialize<T>(this ISerializer serializer, T obj) 
        => SerializeAsync(serializer, obj).SynchronouslyAwait();
    
    public static T? Deserialize<T>(this ISerializer serializer, string serialized)
        => DeserializeAsync<T>(serializer, serialized).SynchronouslyAwait();
}