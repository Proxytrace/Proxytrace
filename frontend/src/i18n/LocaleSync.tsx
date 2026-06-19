import { useEffect } from 'react'
import { useMe } from '../hooks/useMe'
import { useKiosk } from '../contexts/KioskContext'
import { cacheLocale, dynamicActivate, isLocale } from './index'

/**
 * Applies the authenticated user's stored UI language once /me resolves, and mirrors it to the
 * localStorage cache so the next boot paints in the right language immediately. Renders nothing.
 * Disabled in kiosk mode (no real session to read a preference from).
 */
export function LocaleSync() {
  const { enabled: kiosk } = useKiosk()
  const { data } = useMe({ enabled: !kiosk })
  const language = data?.language

  useEffect(() => {
    if (isLocale(language)) {
      void dynamicActivate(language)
      cacheLocale(language)
    }
  }, [language])

  return null
}
