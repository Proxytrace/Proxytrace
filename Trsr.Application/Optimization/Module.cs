using Autofac;
using Trsr.Application.Optimization.Internal;
using Trsr.Common.Conversion;

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
    }
}