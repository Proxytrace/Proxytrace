using Trsr.Domain.Agent;
using Trsr.Domain.Message;

namespace Trsr.Domain.Evaluator;

public interface IAgenticEvaluator : IEvaluator
{
    public delegate IAgenticEvaluator CreateNew(SystemMessage systemMessage);
    public delegate IAgenticEvaluator CreateExisting(SystemMessage systemMessage, IDomainEntityData existing);
}