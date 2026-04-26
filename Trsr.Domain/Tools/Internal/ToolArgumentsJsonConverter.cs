using System.Text.Json;
using System.Text.Json.Serialization;
using JetBrains.Annotations;

namespace Trsr.Domain.Tools.Internal;

/// <summary>
/// Serialises <see cref="ToolArguments"/> as a JSON Schema object so that tool definitions
/// round-trip cleanly through the storage layer without exposing the internal IToolArgument
/// type hierarchy (which contains a System.Type property that System.Text.Json cannot handle).
/// </summary>
[UsedImplicitly]
internal sealed class ToolArgumentsJsonConverter : JsonConverter<ToolArguments>
{
    public override ToolArguments Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        using var doc = JsonDocument.ParseValue(ref reader);
        return ToolArguments.FromJsonSchema(doc.RootElement);
    }

    public override void Write(Utf8JsonWriter writer, ToolArguments value, JsonSerializerOptions options)
    {
        using var doc = JsonDocument.Parse(value.JsonSchema);
        doc.RootElement.WriteTo(writer);
    }
}
