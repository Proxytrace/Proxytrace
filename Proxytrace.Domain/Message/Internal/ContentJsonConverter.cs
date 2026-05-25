using System.Text.Json;
using System.Text.Json.Serialization;
using JetBrains.Annotations;

namespace Proxytrace.Domain.Message.Internal;

[UsedImplicitly]
internal sealed class ContentJsonConverter : JsonConverter<Content>
{
    public override Content Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        using var doc = JsonDocument.ParseValue(ref reader);
        var root = doc.RootElement;

        if (root.TryGetProperty("Text", out var textProp) && textProp.ValueKind == JsonValueKind.String)
        {
            var text = textProp.GetString() ?? string.Empty;
            return Content.FromText(text);
        }

        if (root.TryGetProperty("Data", out var dataProp) && dataProp.ValueKind == JsonValueKind.String)
        {
            return Content.FromImage(BinaryData.FromBytes(Convert.FromBase64String(dataProp.GetString() ?? string.Empty)));
        }

        throw new JsonException("Cannot deserialize Content: missing Text or Data property");
    }

    public override void Write(Utf8JsonWriter writer, Content value, JsonSerializerOptions options)
    {
        writer.WriteStartObject();
        if (value.Text != null)
        {
            writer.WriteString("Text", value.Text);
        }
        if (value.Data != null)
        {
            writer.WriteString("Data", Convert.ToBase64String(value.Data.ToArray()));
        }
        writer.WriteEndObject();
    }
}