namespace Trsr.Domain.AgentCall;

public interface IAgentCallGenerator : IDomainEntityGenerator<IAgentCall>
{
    Task<IAgentCall> CreateAsync(DateTimeOffset createdAt,  CancellationToken cancellationToken = default);
}