namespace Trsr.Api.Services;

public interface ITestRunQueue
{
    void Enqueue(Guid runId);
}
