namespace Trsr.Domain.Evaluator;

/// <summary>
/// Checks whether the output matches the given Json schema
/// </summary>
public interface IJsonSchemaMatchEvaluator : IEvaluator
{
    string JsonSchema { get; }
    
    public delegate IJsonSchemaMatchEvaluator CreateNew(
        string jsonSchema);
    
    public delegate IJsonSchemaMatchEvaluator CreateExisting(
        string jsonSchema,
        IDomainEntityData existing);
}