import { defineConfig } from '@lingui/conf'
import { formatter } from '@lingui/format-po'

// English is the source language; `lingui extract` populates en/messages.po from the macros in
// the code, and the translation tool (scripts/i18n/translate.mjs) fills the other catalogs.
// Keep `locales` in sync with the backend's Proxytrace.Domain.User.SupportedLanguages.
export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'de', 'fr', 'es', 'it'],
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['src'],
    },
  ],
  format: formatter({ origins: false }),
})
