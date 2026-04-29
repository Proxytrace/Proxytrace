using Autofac;
using Trsr.Application.Agent;
using Trsr.Application.Ai;
using Trsr.Application.Ai.Internal;
using Trsr.Domain.Agent;

namespace Trsr.Application;

public sealed class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

        builder.RegisterType<AiClientFactory>()
            .As<IAiClientFactory>()
            .SingleInstance();

        builder.RegisterType<AgentNameGenerator>()
            .As<IAgentNameGenerator>()
            .SingleInstance();
    }
}
