import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
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
])
