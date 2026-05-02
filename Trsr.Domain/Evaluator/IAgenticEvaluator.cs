using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.Evaluator;

public interface IAgenticEvaluator : IEvaluator
{
    SystemMessage SystemMessage { get; }
    IModelEndpoint Endpoint { get; }
}