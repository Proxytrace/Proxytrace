import { useQueryClient } from '@tanstack/react-query';
import { Trans, useLingui } from '@lingui/react/macro';
import { Switch } from '../ui/Switch';
import { Select } from '../ui/Select';
import { Menu } from '../ui/Menu';
import { NotificationSeverity } from '../../api/models';
import { usersApi } from '../../api/users';
import { QUERY_KEYS } from '../../api/query-keys';
import { useMe } from '../../hooks/useMe';

/**
 * Per-user email-notification preference control rendered inside the account dropdown (Shell).
 * Rendered only when the operator has email delivery enabled (`me.emailEnabled`). Lets the user
 * toggle their own email alerts and pick a minimum severity. Mirrors LanguageMenuItems' pattern:
 * reads useMe, calls usersApi directly on change, then invalidates QUERY_KEYS.me.
 */
export function EmailNotificationMenuItems() {
  const { t } = useLingui();
  const qc = useQueryClient();
  const { data: me } = useMe();

  if (!me || !me.emailEnabled) return null;

  async function save(enabled: boolean, minSeverity: NotificationSeverity) {
    await usersApi.updateMyEmailNotifications(enabled, minSeverity);
    await qc.invalidateQueries({ queryKey: QUERY_KEYS.me });
  }

  return (
    <>
      <Menu.Group data-testid="email-notification-menu-group">
        <Menu.Label>
          <Trans>Email notifications</Trans>
        </Menu.Label>
        <div className="px-3.5 py-2 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={me.emailNotificationsEnabled}
              onChange={(v) => void save(v, me.emailNotificationMinSeverity)}
              aria-label={t`Receive email alerts`}
              data-testid="email-notifications-toggle"
            />
            <span className="text-body text-secondary">
              <Trans>Receive email alerts</Trans>
            </span>
          </div>
          <Select
            value={me.emailNotificationMinSeverity}
            onValueChange={(v) => void save(me.emailNotificationsEnabled, v as NotificationSeverity)}
            disabled={!me.emailNotificationsEnabled}
            inputSize="sm"
            data-testid="email-notifications-severity"
          >
            <option value={NotificationSeverity.Info}>{t`Info and above`}</option>
            <option value={NotificationSeverity.Warning}>{t`Warning and above`}</option>
            <option value={NotificationSeverity.Critical}>{t`Critical only`}</option>
          </Select>
        </div>
      </Menu.Group>
      <Menu.Separator />
    </>
  );
}
