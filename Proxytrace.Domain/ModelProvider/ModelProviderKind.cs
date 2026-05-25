namespace Proxytrace.Domain.ModelProvider;

/// <summary>
/// The kind of model provider
/// </summary>
public enum ModelProviderKind
{
    Unknown = 0,
    Anthropic = 1,
    OpenAi = 2,
    OpenAiCompatible = 3,
}