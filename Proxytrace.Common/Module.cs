using Autofac;
using Proxytrace.Common.Async;
using Proxytrace.Common.Conversion;
using Proxytrace.Common.Conversion.Internal;
using Proxytrace.Common.Hosting;
using Proxytrace.Common.Lifecycle;
using Proxytrace.Common.Lifecycle.Internal;
using Proxytrace.Common.Random;
using Proxytrace.Common.Random.Internal;
using Proxytrace.Common.Serialization;
using Proxytrace.Common.Serialization.Internal;

namespace Proxytrace.Common;

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

        builder.RegisterType<JsonSerializer>()
            .As<ISerializer>()
            .SingleInstance();

        builder.RegisterType<AsyncLock>().As<IAsyncLock>();

        builder.RegisterType<NullHostedService>().AsSelf();
        
        builder.RegisterType<TempDirectory>()
            .As<ITempDirectory>()
            .OwnedByLifetimeScope();
    }
}