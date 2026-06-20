import { defineConfig } from 'vitest/config'
import { lingui, linguiTransformerBabelPreset } from '@lingui/vite-plugin'
import babel from '@rolldown/plugin-babel'

export default defineConfig({
  // The Lingui macros (Trans, t, plural, msg) must be compiled in tests too — otherwise modules
  // that use them fall back to the runtime babel-plugin-macros shim and fail to import. Mirror the
  // macro transform from vite.config.ts.
  plugins: [lingui(), babel({ presets: [linguiTransformerBabelPreset()] })],
  test: {
    environment: 'node',
  },
})
