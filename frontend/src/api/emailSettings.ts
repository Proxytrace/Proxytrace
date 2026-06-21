import { api } from './client';
import type { NotificationSeverity } from './models';

export type SmtpSecurity = 'None' | 'StartTls' | 'Auto' | 'SslOnConnect';

export interface EmailSettings {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  security: SmtpSecurity;
  username: string | null;
  passwordSet: boolean;
  fromAddress: string;
  fromName: string;
  appBaseUrl: string | null;
  minSeverity: NotificationSeverity;
}

export interface UpdateEmailSettings {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  security: SmtpSecurity;
  username: string | null;
  /** Write-only: omit/empty keeps the stored password. */
  password: string | null;
  fromAddress: string;
  fromName: string;
  appBaseUrl: string | null;
  minSeverity: NotificationSeverity;
}

export const emailSettingsApi = {
  /** GET returns 204 (undefined) when never configured. */
  get: () => api.get<EmailSettings | undefined>(`/api/email-settings`),
  update: (body: UpdateEmailSettings) => api.put<EmailSettings>(`/api/email-settings`, body),
  sendTest: () => api.post<void>(`/api/email-settings/test`),
};
