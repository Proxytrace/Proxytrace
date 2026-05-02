using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Evaluator;

public interface ICustomEvaluator : IAgenticEvaluator
{
    string Name { get; }

    public delegate ICustomEvaluator CreateNew(
        string name,
        SystemMessage systemMessage,
        IModelEndpoint endpoint);

    public delegate ICustomEvaluator CreateExisting(
        string name,
        SystemMessage systemMessage,
        IModelEndpoint endpoint,
        IDomainEntityData existing);
}