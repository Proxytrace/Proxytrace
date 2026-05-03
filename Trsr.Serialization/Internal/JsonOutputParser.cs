using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Schema;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;

namespace Trsr.Serialization.Internal;

    /// <inheritdoc />
internal class JsonOutputParser<TOutput> : IOutputParser<TOutput>
{
    private readonly ISerializer serializer;
    private readonly Lazy<IOutputFormat> lazySchemaDefinition;
    
    public JsonOutputParser(
        ISerializer serializer,
        IOutputFormat.FromJsonSchema outputFormatFactory)
    {
        this.serializer = serializer;
        
        JsonSerializerOptions jsonSerializerOptions = new()
        {
            TypeInfoResolver = new DefaultJsonTypeInfoResolver(),
            PropertyNameCaseInsensitive = true
        };

        // Add JsonStringEnumConverter to handle both integer and string enum values
        jsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: true));

        JsonSchemaExporterOptions jsonSchemaExporterOptions = new()
        {
            TreatNullObliviousAsNonNullable = false,
            TransformSchemaNode = (context, schema) =>
            {
                // Add enum values for enum types
                if (context.TypeInfo.Type.IsEnum)
                {
                    var enumNames = Enum.GetNames(context.TypeInfo.Type);
                    var enumArray = new JsonArray();
                    foreach (var enumName in enumNames)
                    {
                        // Use camelCase to match the JsonStringEnumConverter naming policy
                        var camelCaseName = JsonNamingPolicy.CamelCase.ConvertName(enumName);
                        enumArray.Add(camelCaseName);
                    }
                    schema["enum"] = enumArray;
                }
                
                // Add description from DescriptionAttribute
                var descriptionAttribute = context.PropertyInfo?.AttributeProvider?.GetCustomAttributes(typeof(DescriptionAttribute), inherit: true)
                    .OfType<DescriptionAttribute>()
                    .FirstOrDefault();
                
                if (descriptionAttribute != null && !string.IsNullOrWhiteSpace(descriptionAttribute.Description))
                {
                    schema["description"] = descriptionAttribute.Description;
                }
                
                return schema;
            }
        };

        lazySchemaDefinition = new Lazy<IOutputFormat>(() => outputFormatFactory(jsonSerializerOptions.GetJsonSchemaAsNode(
            typeof(TOutput),
            jsonSchemaExporterOptions).ToString()));
    }
    
    /// <inheritdoc />
    public IOutputFormat Format 
        => lazySchemaDefinition.Value;
    
    /// <inheritdoc />
    public async Task<TOutput?> ParseAsync(string? output, CancellationToken cancellationToken = default)
    {
        // Trim common LLM artifacts
        string? cleanedOutput = TrimArtifacts(output);
        if(cleanedOutput is null)
        {
            return default;
        }
        var deserialized = await serializer.DeserializeAsync<TOutput>(cleanedOutput, cancellationToken);
        if (deserialized is null)
        {
            throw new InvalidOperationException(
                $"Failed to deserialize model output to {typeof(TOutput).FullName}");
        }
        return deserialized;
    }
    
    private string? TrimArtifacts(string? output)
    {
        if (string.IsNullOrWhiteSpace(output))
        {
            return null;
        }

        string cleaned = output.Trim();
        
        // Remove leading backticks with optional language identifier (e.g., ```json, ```csharp)
        if (cleaned.StartsWith("```"))
        {
            int firstNewline = cleaned.IndexOf('\n');
            cleaned = firstNewline > 0
                ? new string(cleaned.Skip(firstNewline + 1).ToArray()).Trim() // Remove the opening ```[language] line 
                : new string(cleaned.Skip(3).ToArray()).Trim(); // Just remove the opening ``` 
        }
        
        // Remove trailing backticks
        if (cleaned.EndsWith("```"))
        {
            cleaned = cleaned[..^3].Trim();
        }
        
        // Remove common prefixes that LLMs might add
        string[] commonPrefixes = ["json:", "Output:", "Result:", "Response:"];
        foreach (string prefix in commonPrefixes)
        {
            if (cleaned.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                cleaned = cleaned[prefix.Length..].Trim();
                break;
            }
        }
        
        // clean up surrounding quotes
        // e.g., \"null\" -> null
        cleaned = cleaned.Trim('\"', '\'');

        return string.Equals(cleaned, "null", StringComparison.OrdinalIgnoreCase) 
            ? null 
            : cleaned;
    }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (ValidationResult validationResult in lazySchemaDefinition.Value.Validate(validationContext))
        {
            yield return validationResult;
        }
    }
}