import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { NotificationSeverity } from '../../../api/models';
import type { SmtpSecurity, UpdateEmailSettings } from '../../../api/emailSettings';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { SectionHeader } from '../components/SectionHeader';
import { ToggleRow } from '../components/ToggleRow';
import { useEmailSettings, useSendTestEmail, useUpdateEmailSettings } from '../hooks/useEmailSettings';

const EMPTY: UpdateEmailSettings = {
  enabled: false,
  smtpHost: '',
  smtpPort: 587,
  security: 'StartTls',
  username: null,
  password: null,
  fromAddress: '',
  fromName: '',
  appBaseUrl: null,
  minSeverity: NotificationSeverity.Warning,
};

export function EmailNotificationsSection() {
  const { t } = useLingui();
  const { data, isLoading } = useEmailSettings();
  const update = useUpdateEmailSettings();
  const sendTest = useSendTestEmail();

  // Derive-on-change draft (BEST_PRACTICES §4.1): track the loaded value and reset draft when
  // it changes during render. No useEffect — see §4.
  const [loaded, setLoaded] = useState<typeof data>(undefined);
  const [draft, setDraft] = useState<UpdateEmailSettings>(EMPTY);
  if (data !== loaded) {
    setLoaded(data);
    setDraft(data ? { ...data, password: null } : EMPTY);
  }

  return (
    <div className="w-full min-w-0 flex flex-col" data-testid="settings-email-notifications">
      <SectionHeader
        title={t`Email notifications`}
        subtitle={t`Send notification alerts to your users by email.`}
      />
      <div className="max-w-[760px] flex flex-col gap-5">
        <div className="bg-card-2 border border-hairline rounded-[12px] p-4 flex flex-col gap-3">
          <ToggleRow
            label={t`Enable email notifications`}
            description={t`When on, notifications are emailed to users who opt in.`}
            checked={draft.enabled}
            onChange={(v) => setDraft({ ...draft, enabled: v })}
            testId="email-enabled"
          />
          <FormField label={t`SMTP host`}>
            <Input
              value={draft.smtpHost}
              onChange={(e) => setDraft({ ...draft, smtpHost: e.target.value })}
              data-testid="email-smtp-host"
            />
          </FormField>
          <FormField label={t`SMTP port`}>
            <Input
              type="number"
              value={String(draft.smtpPort)}
              onChange={(e) => setDraft({ ...draft, smtpPort: Number(e.target.value) })}
              className="max-w-[160px]"
              data-testid="email-smtp-port"
            />
          </FormField>
          <FormField label={t`Security`}>
            <Select
              value={draft.security}
              onValueChange={(v) => setDraft({ ...draft, security: v as SmtpSecurity })}
              data-testid="email-security"
            >
              <option value="None">{t`None`}</option>
              <option value="StartTls">STARTTLS</option>
              <option value="Auto">{t`Auto`}</option>
              <option value="SslOnConnect">SSL</option>
            </Select>
          </FormField>
          <FormField label={t`Username`}>
            <Input
              value={draft.username ?? ''}
              onChange={(e) => setDraft({ ...draft, username: e.target.value || null })}
              data-testid="email-username"
            />
          </FormField>
          <FormField label={t`Password`}>
            <Input
              type="password"
              placeholder={data?.passwordSet ? t`Leave blank to keep current password` : ''}
              value={draft.password ?? ''}
              onChange={(e) => setDraft({ ...draft, password: e.target.value || null })}
              data-testid="email-password"
            />
          </FormField>
          <FormField label={t`From name`}>
            <Input
              value={draft.fromName}
              onChange={(e) => setDraft({ ...draft, fromName: e.target.value })}
              data-testid="email-from-name"
            />
          </FormField>
          <FormField label={t`From address`}>
            <Input
              value={draft.fromAddress}
              onChange={(e) => setDraft({ ...draft, fromAddress: e.target.value })}
              data-testid="email-from-address"
            />
          </FormField>
          <FormField label={t`App URL (for links in emails)`}>
            <Input
              value={draft.appBaseUrl ?? ''}
              onChange={(e) => setDraft({ ...draft, appBaseUrl: e.target.value || null })}
              data-testid="email-app-base-url"
            />
          </FormField>
          <FormField label={t`Minimum severity`}>
            <Select
              value={draft.minSeverity}
              onValueChange={(v) => setDraft({ ...draft, minSeverity: v as NotificationSeverity })}
              data-testid="email-min-severity"
            >
              <option value={NotificationSeverity.Info}>{t`Info`}</option>
              <option value={NotificationSeverity.Warning}>{t`Warning`}</option>
              <option value={NotificationSeverity.Critical}>{t`Critical`}</option>
            </Select>
          </FormField>
          <div className="flex gap-2 pt-2 border-t border-hairline">
            <Button
              variant="primary"
              size="sm"
              loading={update.isPending}
              data-testid="email-save-btn"
              onClick={() => update.mutate(draft)}
            >
              <Trans>Save changes</Trans>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={sendTest.isPending}
              disabled={isLoading}
              data-testid="email-send-test-btn"
              onClick={() => sendTest.mutate()}
            >
              <Trans>Send test email</Trans>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
