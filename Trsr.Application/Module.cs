using Autofac;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Application.Agent;
using Trsr.Application.TestRun;
using Trsr.Application.TestRun.Internal;
using Trsr.Common.DependencyInjection;
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
        
        builder.RegisterType<TestRunnerService>()
            .AsImplementedInterfaces()
            .AsSelf()
            .SingleInstance();

        builder.RegisterServiceCollection(services 
            => services.AddHostedService(sc => sc.GetRequiredService<TestRunnerService>()));
    }
}
