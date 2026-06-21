namespace Proxytrace.Api.Dto.EmailSettings;

public sealed class EmailSettingsDtoMapper
{
    public EmailSettingsDto ToDto(Application.Notifications.EmailSettings s) => new(
        s.Enabled, s.SmtpHost, s.SmtpPort, s.Security, s.Username,
        PasswordSet: !string.IsNullOrEmpty(s.Password),
        s.FromAddress, s.FromName, s.AppBaseUrl, s.MinSeverity);
}
