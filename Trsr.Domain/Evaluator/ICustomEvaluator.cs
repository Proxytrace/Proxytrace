using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Evaluator;

public interface ICustomEvaluator : IAgenticEvaluator
{
    public delegate ICustomEvaluator CreateNew(
        SystemMessage systemMessage,
        IModelEndpoint endpoint);
    
    public delegate ICustomEvaluator CreateExisting(
        SystemMessage systemMessage,
        IModelEndpoint endpoint,
        IDomainEntityData existing);
}