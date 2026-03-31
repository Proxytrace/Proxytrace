using Trsr.Domain.Agent;
using Trsr.Domain.Evaluator;
using Trsr.Domain.TestCase;

namespace Trsr.Domain.TestSuite;

public interface ITestSuite : IDomainEntity
{
    public delegate ITestSuite CreateNew(
        IAgent agent, 
        IEvaluator evaluator, 
        IReadOnlyCollection<ITestCase> testCases);
    
    public delegate ITestSuite CreateExisting(
        IAgent agent,
        IEvaluator evaluator, 
        IReadOnlyCollection<ITestCase> testCases,
        IDomainEntityData existing);
    
    public IAgent Agent { get; }
    public IEvaluator Evaluator { get; }
    public IReadOnlyCollection<ITestCase> TestCases { get; }
}
