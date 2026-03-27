using Autofac;
using Trsr.Common.Conversion;
using Trsr.Common.Conversion.Internal;

namespace Trsr.Common;

public class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);
        
        builder.RegisterType<TypeConverter>()
            .As<ITypeConverter>()
            .SingleInstance();
    }
}