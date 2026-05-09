using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;

namespace Trsr.Domain.Message;

public sealed record Content : IDomainObject
{
    public ContentKind Kind 
        => Data != null ? ContentKind.Image : ContentKind.Text;
    
    public string? Text { get; }
    
    public BinaryData? Data { get; }

    private Content(
        string? text,
        BinaryData? data)
    {
        Text = text;
        Data  = data;
    }
    
    public static Content FromText(string text)
        => new(text, null);
    
    public static Content FromImage(BinaryData data)
        => new(null, data);
    
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Text.NotNullOrWhiteSpace() && Data != null)
        {
            yield return new ValidationResult(
                $"Content cannot have both text and data. Text: '{Text}', Data length: {Data.Length}",
                [nameof(Text), nameof(Data)]);
            yield break;
        }

        if (Text.NullOrWhiteSpace() && Data is null)
        {
            yield return new ValidationResult(
                "Content must have either text or data.",
                [nameof(Text), nameof(Data)]);
            yield break;
        }
        
        if (Kind is ContentKind.Text)
        {
            foreach (var __r in Validation.NotNullOrWhiteSpace(Text).AsEnumerable()) yield return __r;
            foreach (var __r in Validation.MaxLength(Text, 10_000).AsEnumerable()) yield return __r;
            foreach (var __r in Validation.NotEmpty(Text).AsEnumerable()) yield return __r;
        }
        
        if (Kind is ContentKind.Image)
        {
            foreach (var __r in Validation.NotNull(Data).AsEnumerable()) yield return __r;
            foreach (var __r in Validation.NotNullOrWhiteSpace(Data?.MediaType).AsEnumerable()) yield return __r;
        }
    }

    /// <inheritdoc />
    public bool Equals(Content? other)
        => other is not null &&
           Equals(Kind, other.Kind) &&
           Equals(Text, other.Text) &&
           ((Data == null && other.Data == null) ||
            (Data?.ToArray() ?? []).SequenceEqual(other.Data?.ToArray() ?? []));

    /// <inheritdoc />
    public override int GetHashCode() 
        => HashCode.Combine((int)Kind, Text, Data);
}