using Autofac;
using Microsoft.Extensions.Logging.Abstractions;
using Trsr.Application.TestRun.Internal;

namespace Trsr.Application.Tests;

public class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);
        builder.RegisterType<TestRunnerService>()
            .AsImplementedInterfaces()
            .SingleInstance();

        builder
            .Register(_ => NullLogger<TestRunnerService>.Instance)
            .As<Microsoft.Extensions.Logging.ILogger<TestRunnerService>>()
            .SingleInstance();
    }
}