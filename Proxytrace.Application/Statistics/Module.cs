using Autofac;
using Microsoft.Extensions.DependencyInjection;
using Proxytrace.Application.Statistics.Internal;
using Proxytrace.Application.Statistics.Internal.Worker;
using Proxytrace.Application.Statistics.TestRun.Internal;
using Proxytrace.Common.DependencyInjection;

namespace Proxytrace.Application.Statistics;

internal class Module : Autofac.Module
{
    protected override void Load(ContainerBuilder builder)
    {
        base.Load(builder);

        builder.RegisterType<TestRunStatsProjector>()
            .As<IStatsProjector>()
            .SingleInstance();

        builder.RegisterType<StatisticsService>()
            .As<IStatisticsService>()
            .SingleInstance();

        builder.RegisterType<StatisticsHostedService>()
            .AsSelf()
            .SingleInstance();

        builder.RegisterServiceCollection(services =>
            services.AddHostedService(sc => sc.GetRequiredService<StatisticsHostedService>()));

        builder.RegisterType<StatisticsBackfillHostedService>()
            .AsSelf()
            .SingleInstance();

        builder.RegisterServiceCollection(services =>
            services.AddHostedService(sc => sc.GetRequiredService<StatisticsBackfillHostedService>()));
    }
}
