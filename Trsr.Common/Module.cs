using Autofac;
using Trsr.Common.Conversion;
using Trsr.Common.Conversion.Internal;
using Trsr.Common.Random;
using Trsr.Common.Random.Internal;

namespace Trsr.Common;

public class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);
        
        builder
            .RegisterType<TypeConverter>()
            .As<ITypeConverter>()
            .SingleInstance();

        builder.RegisterType<SeededRandom>()
            .AsSelf();
        
        builder
            .Register(c => c.Resolve<SeededRandom.Factory>()(seed: 420))
            .As<IRandom>()
            .SingleInstance();
    }
}