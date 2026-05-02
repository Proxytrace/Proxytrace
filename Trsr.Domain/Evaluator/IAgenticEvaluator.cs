using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Evaluator;

public interface IAgenticEvaluator : IEvaluator
{
    public delegate IAgenticEvaluator CreateNew(
        SystemMessage systemMessage,
        IModelEndpoint endpoint);
    public delegate IAgenticEvaluator CreateExisting(
        SystemMessage systemMessage,
        IModelEndpoint endpoint,
        IDomainEntityData existing);

    SystemMessage SystemMessage { get; }
    IModelEndpoint Endpoint { get; }
}