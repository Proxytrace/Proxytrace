namespace Proxytrace.Api.Dto.OutlierSettings;

public sealed class OutlierSettingsDtoMapper
{
    public OutlierSettingsDto ToDto(Application.Outliers.OutlierSettings s) => new(
        s.Enabled, s.SigmaMultiplier, s.MinSampleCount, s.SampleWindow);
}
