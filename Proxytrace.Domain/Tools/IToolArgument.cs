namespace Proxytrace.Domain.Tools;

/// <summary>
/// A tool argument
/// </summary>
public interface IToolArgument : IDomainObject
{
    /// <summary>
    /// The name of the argument.
    /// </summary>
    string Name { get;  }
    
    /// <summary>
    /// The description of the argument.
    /// </summary>
    string? Description { get; }
    
    /// <summary>
    /// Whether the argument is required.
    /// </summary>
    bool IsRequired { get; }
    
    /// <summary>
    /// The type of the argument.
    /// </summary>
    Type Type { get; }
    
    /// <summary>
    /// The default value of the argument, if any.
    /// </summary>
    public object? DefaultValue { get; }
    
    /// <summary>
    /// The JSON schema definition of the argument.
    /// </summary>
    string JsonSchema { get;  }
}