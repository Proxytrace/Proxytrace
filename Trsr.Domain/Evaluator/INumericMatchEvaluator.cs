using System.Text.RegularExpressions;

namespace Trsr.Domain.Evaluator;

/// <summary>
/// Check for numeric match within a certain tolerance
/// </summary>
public interface INumericMatchEvaluator : IEvaluator
{
    public delegate INumericMatchEvaluator CreateNew(
        Regex extractionPattern,
        decimal tolerance);
    
    public delegate INumericMatchEvaluator CreateExisting(
        Regex extractionPattern,
        decimal tolerance,
        IDomainEntityData existing);
    
    Regex ExtractionPattern { get; }
    decimal Tolerance { get; }
}