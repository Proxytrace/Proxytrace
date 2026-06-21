import { useQueryClient } from '@tanstack/react-query';
import { Trans, useLingui } from '@lingui/react/macro';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Menu } from '../ui/Menu';
import { NotificationSeverity } from '../../api/models';
import { usersApi } from '../../api/users';
import { QUERY_KEYS } from '../../api/query-keys';
import { useMe } from '../../hooks/useMe';

/** The three email-notification choices, collapsing the enabled flag + severity into one control. */
type EmailPref = 'all' | 'critical' | 'none';

/**
 * Per-user email-notification preference control rendered inside the account dropdown (Shell).
 * Rendered only when the operator has email delivery enabled (`me.emailEnabled`). One tri-state
 * control folds the on/off toggle and the severity threshold together:
 *
 *   - **All**      → every notification (Info and above)
 *   - **Critical** → critical alerts only
 *   - **None**     → email alerts off
 *
 * It is an inline SegmentedControl rather than a Select: a Select is itself a Radix dropdown, and
 * nesting one inside this Radix menu portalled its option list *behind* the menu (lower z-index),
 * so all but the last option were hidden. The segmented control renders in the menu's own flow.
 */
export function EmailNotificationMenuItems() {
  const { t } = useLingui();
  const qc = useQueryClient();
  const { data: me } = useMe();

  if (!me || !me.emailEnabled) return null;

  // Derive the active choice from the stored (enabled, severity) pair. Any non-Critical severity
  // (Info, or a legacy Warning) reads as "All"; the next save normalizes it to Info.
  const selected: EmailPref = !me.emailNotificationsEnabled
    ? 'none'
    : me.emailNotificationMinSeverity === NotificationSeverity.Critical
      ? 'critical'
      : 'all';

  async function apply(pref: EmailPref) {
    if (pref === selected) return;
    const enabled = pref !== 'none';
    const minSeverity =
      pref === 'critical' ? NotificationSeverity.Critical : NotificationSeverity.Info;
    await usersApi.updateMyEmailNotifications(enabled, minSeverity);
    await qc.invalidateQueries({ queryKey: QUERY_KEYS.me });
  }

  const hint: Record<EmailPref, string> = {
    all: t`All alerts by email`,
    critical: t`Critical alerts by email`,
    none: t`No email alerts`,
  };

  return (
    <>
      <Menu.Group data-testid="email-notification-menu-group">
        <Menu.Label>
          <Trans>Notifications</Trans>
        </Menu.Label>
        <div className="px-3.5 py-2 flex flex-col gap-1.5" data-testid="email-notifications-control">
          <SegmentedControl
            value={selected}
            onChange={(v) => void apply(v)}
            className="w-fit"
            segments={[
              { value: 'all', label: t`All`, ariaLabel: t`Email all alerts`, testId: 'email-notifications-all' },
              { value: 'critical', label: t`Critical`, ariaLabel: t`Email critical alerts only`, testId: 'email-notifications-critical' },
              { value: 'none', label: t`None`, ariaLabel: t`No email alerts`, testId: 'email-notifications-none' },
            ]}
          />
          <span className="text-caption text-muted">{hint[selected]}</span>
        </div>
      </Menu.Group>
      <Menu.Separator />
    </>
  );
}
