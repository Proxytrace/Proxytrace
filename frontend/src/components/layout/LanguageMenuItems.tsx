import { useQueryClient } from '@tanstack/react-query';
import { Trans } from '@lingui/react/macro';
import { Menu } from '../ui/Menu';
import { CheckIcon, LocaleFlag } from '../icons';
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
      <Menu.Group data-testid="language-menu-group">
        <Menu.Label>
          <Trans>Language</Trans>
        </Menu.Label>
        {SUPPORTED_LOCALES.map(locale => (
          <Menu.Item
            key={locale}
            data-testid={`lang-option-${locale}`}
            icon={<LocaleFlag locale={locale} />}
            onSelect={() => void change(locale)}
          >
            <span className="flex-1">{LOCALE_NAMES[locale]}</span>
            {locale === active ? <CheckIcon size={14} className="ml-2 shrink-0 text-accent" /> : null}
          </Menu.Item>
        ))}
      </Menu.Group>
      <Menu.Separator />
    </>
  );
}
