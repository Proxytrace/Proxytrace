using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Proxytrace.Domain.Prompt;

namespace Proxytrace.Domain.Message;

/// <summary>
/// Represents a message consisting of a role and associated content.
/// </summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = nameof(Role))]
[JsonDerivedType(typeof(UserMessage), nameof(Role.User))]
[JsonDerivedType(typeof(AssistantMessage), nameof(Role.Assistant))]
[JsonDerivedType(typeof(SystemMessage), nameof(Role.System))]
[JsonDerivedType(typeof(ToolMessage), nameof(Role.Tool))]
public abstract record Message : IDomainObject
{
    /// <summary>
    /// The role of the message
    /// </summary>
    [JsonIgnore]
    public Role Role { get; }
    
    /// <summary>
    /// The content of the message
    /// </summary>
    public IReadOnlyList<Content> Contents { get; }

    /// <summary>
    /// Initializes a new instance of the <see cref="Message"/> class with the specified role and contents.
    /// </summary>
    /// <param name="role">The role of the message.</param>
    /// <param name="contents">The contents of the message.</param>
    protected Message(
        Role role,
        IReadOnlyList<Content> contents)
    {
        Role = role;
        Contents = contents;
    }
    
    /// <summary>
    /// Creates a new <see cref="Role.User"/> message with the <paramref name="content"/>
    /// </summary>
    public static UserMessage CreateUserMessage(string content)
        => CreateUserMessage([Content.FromText(content)]);
    
    /// <summary>
    /// Creates a new <see cref="Domain.Message.Role.System"/> message with the <paramref name="systemPrompt"/>
    /// </summary>
    /// TODO: Remove this overload
    public static SystemMessage CreateSystemMessage(string systemPrompt)
        => new(systemPrompt);
    
    public static SystemMessage CreateSystemMessage(
        IPromptTemplate template, 
        IReadOnlyDictionary<string, string>? variables = null)
        => new(template.Render(variables).ToPromptString());
    
    /// <summary>
    /// Creates a new <see cref="Role.User"/> message with the <paramref name="content"/>
    /// </summary>
    public static UserMessage CreateUserMessage(IReadOnlyList<Content> content)
        => new(content);

    /// <summary>
    /// Creates a new <see cref="Role.Assistant"/> message with the given <paramref name="contents"/> and tool requests.
    /// </summary>
    public static AssistantMessage CreateAssistantMessage(
        IReadOnlyList<Content> contents,
        IReadOnlyList<ToolRequest> toolRequests)
        => new(contents, toolRequests);
    
    /// <summary>
    /// Creates a new <see cref="Role.Tool"/> message with the given <paramref name="response"/>.
    /// </summary>
    public static ToolMessage CreateToolMessage(ToolResponse response)
        => new(response);

    /// <summary>
    /// Returns the concatenated text content of this message.
    /// </summary>
    public virtual string GetText()
        => string.Concat(Contents.Select(c => c.Text ?? ""));

    /// <inheritdoc />
    public virtual IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        => Contents.SelectMany(content => content.Validate(validationContext));

    /// <inheritdoc />
    public virtual bool Equals(Message? other)
        => other is not null &&
           Role == other.Role &&
           Contents.SequenceEqual(other.Contents);

    /// <inheritdoc />
    public override int GetHashCode() 
        => HashCode.Combine(Role, Contents);

    public override string ToString()
        => $"{Role}: {string.Join(Environment.NewLine, Contents.Select(c => c.ToString()))}";
}