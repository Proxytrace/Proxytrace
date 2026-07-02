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
            // Restore the media type written alongside the bytes — without it the round-tripped
            // content fails Content.Validate (image content requires a media type).
            string? mediaType = root.TryGetProperty("MediaType", out var mediaTypeProp)
                                && mediaTypeProp.ValueKind == JsonValueKind.String
                ? mediaTypeProp.GetString()
                : null;
            var bytes = Convert.FromBase64String(dataProp.GetString() ?? string.Empty);
            return Content.FromImage(BinaryData.FromBytes(bytes, mediaType));
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
            if (value.Data.MediaType != null)
            {
                writer.WriteString("MediaType", value.Data.MediaType);
            }
        }
        writer.WriteEndObject();
    }
}