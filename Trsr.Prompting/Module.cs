using Autofac;
using JetBrains.Annotations;
using Trsr.Prompting.Internal;

namespace Trsr.Prompting;

/// <summary>
/// Service registration for prompting
/// </summary>
[UsedImplicitly]
public sealed class Module : Autofac.Module
{
    /// <summary>
    /// Add services for prompting
    /// </summary>
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

    }
}