import { i18n } from '@lingui/core'

// The set of UI languages, kept in sync with the backend's
// Proxytrace.Domain.User.SupportedLanguages and lingui.config.ts `locales`.
export const SUPPORTED_LOCALES = ['en', 'de'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

/** Native display name per locale, shown in the language selector. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  de: 'Deutsch',
}

export const DEFAULT_LOCALE: Locale = 'en'

const STORAGE_KEY = 'proxytrace.lang'

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/** Reads the cached locale (last explicit choice), if any and still supported. */
export function getCachedLocale(): Locale | null {
  try {
    const cached = localStorage.getItem(STORAGE_KEY)
    return isLocale(cached) ? cached : null
  } catch {
    return null
  }
}

/** Persists the user's locale so the next boot paints in the right language immediately. */
export function cacheLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // localStorage can be unavailable (private mode / kiosk); the backend pref still wins.
  }
}

/**
 * Best-effort locale for first paint, before the authenticated user's stored preference is known:
 * cached choice → browser language → English.
 */
export function resolveInitialLocale(): Locale {
  const cached = getCachedLocale()
  if (cached) return cached
  const browser = typeof navigator !== 'undefined' ? navigator.language?.split('-')[0] : undefined
  if (isLocale(browser)) return browser
  return DEFAULT_LOCALE
}

/** Loads the compiled catalog for `locale` and makes it the active language. */
export async function dynamicActivate(locale: Locale): Promise<void> {
  const { messages } = await import(`../locales/${locale}/messages.po`)
  i18n.loadAndActivate({ locale, messages })
}

export { i18n }
