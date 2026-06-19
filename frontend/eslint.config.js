import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import lingui from 'eslint-plugin-lingui'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Ban raw styled control elements — use the components/ui primitives instead.
    // (DESIGN.md §3.1). Primitive leaf files that legitimately render the raw
    // element are exempted below. Currently 'warn' during migration; flipped to
    // 'error' once the codebase is clean.
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      // The components/ui/* primitive layer renders raw control elements on
      // purpose — it IS the implementation behind the primitives.
      'src/components/ui/**',
      // Bespoke command palette (own keyboard/focus model) + range slider:
      'src/components/search/UnifiedSearch.tsx',
      'src/features/playground/components/ParameterSlider.tsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.name='button']",
          message:
            'Use <Button>/<IconButton> from components/ui — never a raw <button>. (DESIGN.md §3.1) Escape hatch: // eslint-disable-next-line no-restricted-syntax -- <reason>',
        },
        {
          selector: "JSXOpeningElement[name.name='input']",
          message:
            'Use <Input>/<Checkbox>/<Radio>/<Switch> from components/ui — not a raw <input>. (type="range"/"file" are exceptions; disable with justification.)',
        },
        {
          selector: "JSXOpeningElement[name.name='select']",
          message: 'Use <Select> or <Combobox> from components/ui — not a raw <select>.',
        },
        {
          selector: "JSXOpeningElement[name.name='textarea']",
          message: 'Use <Textarea> from components/ui — not a raw <textarea>.',
        },
      ],
    },
  },
  {
    // i18n guardrail: every user-facing string must go through the Lingui macros
    // (<Trans>, t``, plural, msg). `no-unlocalized-strings` flags raw strings so they don't slip
    // back in. Currently 'warn' during the big-bang migration; flip to 'error' once the codebase
    // is clean (same lifecycle as the no-restricted-syntax rule above).
    // Scope to .tsx (where UI text lives). Plain .ts files are data/config/query-keys whose
    // string literals are not user copy; UI strings that live in .ts label maps are wrapped with
    // the `msg` macro and caught at use sites.
    files: ['src/**/*.tsx'],
    ignores: [
      'src/**/*.spec.tsx',
      'src/**/*.test.tsx',
    ],
    plugins: { lingui },
    rules: {
      // Catch a <Trans> wrapping a single child that needs no translation, nested <Trans>, etc.
      'lingui/no-trans-inside-trans': 'warn',
      'lingui/no-single-tag-to-translate': 'warn',
      'lingui/t-call-in-function': 'error',
      'lingui/no-unlocalized-strings': [
        'warn',
        {
          // Strings with no letters at all (numbers, punctuation, css-ish tokens) aren't copy.
          ignore: ['^[^A-Za-z]*$'],
          // Enum-ish props on our own components carry tokens, not user copy. (DOM text attributes
          // like aria-label / placeholder are intentionally NOT ignored — they are UI text.)
          ignoreNames: [
            'variant', 'tone', 'side', 'align', 'placement', 'color', 'size', 'icon',
            'status', 'kind', 'mode', 'type', 'role', 'testId', 'autoComplete', 'key',
          ],
          // Utility calls whose string args are class names / log lines / storage keys, not copy.
          ignoreFunctions: ['cn', 'clsx', 'cva', 'console.*', 'localStorage.*', 'sessionStorage.*'],
        },
      ],
    },
  },
])
