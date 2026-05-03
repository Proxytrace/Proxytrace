using Autofac;
using JetBrains.Annotations;
using Trsr.Serialization.Internal;

namespace Trsr.Serialization;

/// <summary>
/// Sets up serialization services
/// </summary>
[UsedImplicitly]
public sealed class Module : Autofac.Module
{
    /// <summary>
    /// Add serialization services
    /// </summary>
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);
        builder.RegisterType<JsonSerializer>().As<ISerializer>();
        builder.RegisterType<JsonOutputFormat>().AsSelf();
        builder.RegisterType<StringOutputFormat>().AsSelf();

        builder.Register<IOutputFormat.Create>(c =>
        {
            return type =>
            {
                return type switch
                {
                    not null when type == typeof(string) => c.Resolve<StringOutputFormat>(),
                    not null when type == typeof(JsonOutputFormat) => c.Resolve<JsonOutputFormat.Create>()(type),
                    _ => throw new NotSupportedException($"Output format for type {type} is not supported")
                };
            };
        }).AsSelf();
    }
}
