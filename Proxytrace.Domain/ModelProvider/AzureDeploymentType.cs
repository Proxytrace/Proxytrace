namespace Proxytrace.Domain.ModelProvider;

/// <summary>Azure OpenAI deployment SKU; affects retail price. Cannot be auto-detected with an
/// api-key, so it is supplied at request time.</summary>
public enum AzureDeploymentType
{
    GlobalStandard = 0,
    DataZoneStandard = 1,
    Standard = 2,
}
