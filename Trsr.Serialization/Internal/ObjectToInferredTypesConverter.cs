using System.Text.Json;
using System.Text.Json.Serialization;

namespace Trsr.Serialization.Internal;

/// <summary>
/// A JSON converter that deserializes object? properties to their inferred types instead of JsonElement.
/// This prevents JsonElement from appearing in deserialized results when dealing with Dictionary&lt;string, object?&gt; or similar types.
/// </summary>
internal class ObjectToInferredTypesConverter : JsonConverter<object>
{
    /// <inheritdoc />
    public override object? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        return reader.TokenType switch
        {
            JsonTokenType.True => true,
            JsonTokenType.False => false,
            JsonTokenType.Number when reader.TryGetInt32(out int intValue) => intValue,
            JsonTokenType.Number when reader.TryGetInt64(out long longValue) => longValue,
            JsonTokenType.Number => reader.GetDouble(),
            JsonTokenType.String when reader.TryGetDateTime(out DateTime datetime) => datetime,
            JsonTokenType.String when reader.TryGetGuid(out Guid guid) => guid,
            JsonTokenType.String => reader.GetString(),
            JsonTokenType.Null => null,
            JsonTokenType.StartObject => ReadObject(ref reader, options),
            JsonTokenType.StartArray => ReadArray(ref reader, options),
            _ => JsonDocument.ParseValue(ref reader).RootElement.Clone()
        };
    }

    /// <inheritdoc />
    public override void Write(Utf8JsonWriter writer, object value, JsonSerializerOptions options) 
        => System.Text.Json.JsonSerializer.Serialize(writer, value, value.GetType(), options);

    private object ReadObject(ref Utf8JsonReader reader, JsonSerializerOptions options)
    {
        var dictionary = new Dictionary<string, object?>();
        
        while (reader.Read())
        {
            if (reader.TokenType == JsonTokenType.EndObject)
            {
                return dictionary;
            }

            if (reader.TokenType != JsonTokenType.PropertyName)
            {
                throw new JsonException("Expected property name");
            }

            string propertyName = reader.GetString() ?? throw new JsonException("Property name cannot be null");
            reader.Read();
            object? value = Read(ref reader, typeof(object), options);
            dictionary[propertyName] = value;
        }

        throw new JsonException("Expected end of object");
    }

    private object ReadArray(ref Utf8JsonReader reader, JsonSerializerOptions options)
    {
        var list = new List<object?>();
        
        while (reader.Read())
        {
            if (reader.TokenType == JsonTokenType.EndArray)
            {
                return list;
            }

            object? value = Read(ref reader, typeof(object), options);
            list.Add(value);
        }

        throw new JsonException("Expected end of array");
    }
}

