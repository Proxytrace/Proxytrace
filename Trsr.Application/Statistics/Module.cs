using Autofac;
using Microsoft.Extensions.DependencyInjection;
using Trsr.Application.Statistics.Internal;
using Trsr.Application.Statistics.Internal.Worker;
using Trsr.Application.Statistics.TestRun.Internal;
using Trsr.Common.DependencyInjection;

namespace Trsr.Application.Statistics;

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
