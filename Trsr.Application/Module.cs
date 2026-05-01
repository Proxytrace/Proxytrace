using Autofac;
using Trsr.Application.Agent;
using Trsr.Domain.Agent;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Application;

public sealed class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

        builder.RegisterType<AgentNameGenerator>()
            .As<IAgentNameGenerator>()
            .SingleInstance();
    }
}
