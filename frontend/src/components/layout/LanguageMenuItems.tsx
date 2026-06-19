import { useQueryClient } from '@tanstack/react-query';
import { Trans } from '@lingui/react/macro';
import { Menu } from '../ui/Menu';
import { CheckIcon } from '../icons';
import { useMe } from '../../hooks/useMe';
import { useKiosk } from '../../contexts/KioskContext';
import { usersApi } from '../../api/users';
import { QUERY_KEYS } from '../../api/query-keys';
import {
  SUPPORTED_LOCALES,
  LOCALE_NAMES,
  dynamicActivate,
  cacheLocale,
  isLocale,
  resolveInitialLocale,
  type Locale,
} from '../../i18n';

/**
 * Per-user UI language picker rendered inside the account dropdown (Shell). Language is a personal
 * preference every user sets, so it lives here rather than in the admin-only settings hub. Hidden
 * in kiosk mode, where there is no account to persist a choice against.
 */
export function LanguageMenuItems() {
  const { enabled: kiosk } = useKiosk();
  const queryClient = useQueryClient();
  const { data } = useMe({ enabled: !kiosk });

  if (kiosk) return null;

  const active: Locale = isLocale(data?.language) ? data.language : resolveInitialLocale();

  async function change(locale: Locale) {
    if (locale === active) return;
    // Flip the UI instantly and remember for next boot, then persist to the account.
    await dynamicActivate(locale);
    cacheLocale(locale);
    await usersApi.updateMyLanguage(locale);
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.me });
  }

  return (
    <>
      <div className="px-3.5 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
        <Trans>Language</Trans>
      </div>
      {SUPPORTED_LOCALES.map(locale => (
        <Menu.Item
          key={locale}
          data-testid={`lang-option-${locale}`}
          icon={
            <span className="flex w-[15px] justify-center">
              {locale === active ? <CheckIcon size={15} /> : null}
            </span>
          }
          onSelect={() => void change(locale)}
        >
          {LOCALE_NAMES[locale]}
        </Menu.Item>
      ))}
      <Menu.Separator />
    </>
  );
}
