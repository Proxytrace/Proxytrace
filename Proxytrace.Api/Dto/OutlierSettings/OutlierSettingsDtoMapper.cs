namespace Proxytrace.Api.Dto.OutlierSettings;

public sealed class OutlierSettingsDtoMapper
{
    public OutlierSettingsDto ToDto(Domain.Outliers.OutlierSettings s) => new(
        s.Enabled, s.SigmaMultiplier, s.MinSampleCount, s.SampleWindow);
}
