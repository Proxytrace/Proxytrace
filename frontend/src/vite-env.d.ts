/// <reference types="vite/client" />

// Stamped at build time via the `define` block in vite.config.ts.
declare const __APP_VERSION__: string

// Lingui catalogs are imported as `.po` files; the @lingui/vite-plugin turns each into a
// module exposing the compiled `messages` map.
declare module '*.po' {
  import type { Messages } from '@lingui/core'
  export const messages: Messages
}
