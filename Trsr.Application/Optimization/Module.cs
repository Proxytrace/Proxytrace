using Autofac;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Application.Optimization.Internal;
using Trsr.Application.Optimization.Internal.Evidence;
using Trsr.Common.DependencyInjection;

namespace Trsr.Application.Optimization;

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
