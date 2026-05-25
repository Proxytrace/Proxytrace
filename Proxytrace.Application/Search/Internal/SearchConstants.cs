namespace Proxytrace.Application.Search.Internal;

internal static class SearchConstants
{
    public const string FieldId = "id";
    public const string FieldKind = "kind";
    public const string FieldEntityId = "entityId";
    public const string FieldProjectId = "projectId";
    public const string FieldCreatedAt = "createdAt";
    public const string FieldTitle = "title";
    public const string FieldBody = "body";
    public const string FieldBoostedBody = "boostedBody";
    public const string FieldMetadata = "metadata";

    public const float BoostedBodyBoost = 2.0f;
}
