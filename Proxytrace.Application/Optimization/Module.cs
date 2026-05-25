using Autofac;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Application.Optimization.Internal;
using Proxytrace.Application.Optimization.Internal.Evidence;
using Proxytrace.Common.DependencyInjection;

namespace Proxytrace.Application.Optimization;

internal class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

        builder.RegisterType<CompositeOptimizer>()
            .As<IOptimizer>()
            .SingleInstance();

        builder.RegisterType<SwitchModelOptimizer>()
            .As<IOptimizerImplementation>();

        builder.RegisterType<UpdateSystemPromptOptimizer>()
            .As<IOptimizerImplementation>();

        builder.RegisterType<UpdateToolDefinitionOptimizer>()
            .As<IOptimizerImplementation>();

        builder.RegisterType<OptimizerEvidenceBuilder>()
            .As<IOptimizerEvidenceBuilder>();

        builder.RegisterType<OptimizerService>()
            .As<IOptimizerService>()
            .AsImplementedInterfaces()
            .AsSelf()
            .SingleInstance();

        builder.RegisterServiceCollection(services =>
            services.AddHostedService(sc => sc.GetRequiredService<OptimizerService>()));
    }
}
