import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { lingui, linguiTransformerBabelPreset } from '@lingui/vite-plugin'
import babel from '@rolldown/plugin-babel'

// Production-only CSP. Kept out of dev so it doesn't block Vite's HMR websocket.
// script-src 'self' (only hashed same-origin assets, no inline script); style-src
// allows inline for Tailwind/runtime style attrs; connect-src https for OIDC + API + SSE.
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; font-src 'self' data:; connect-src 'self' https:; " +
  "base-uri 'self'; form-action 'self'; object-src 'none'"

function cspMeta(): Plugin {
  return {
    name: 'inject-csp-meta',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace(
        '</head>',
        `  <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n  </head>`,
      ),
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // `lingui()` turns `.po` catalog imports into runtime messages (no separate compile step).
    // The macro transform (Trans, t, plural, …) runs via the rolldown Babel preset, since Vite 8's
    // oxc-based React plugin no longer accepts inline Babel plugins.
    lingui(),
    babel({ presets: [linguiTransformerBabelPreset()] }),
    cspMeta(),
  ],
  // Release version stamped into the bundle by the Docker build (ARG APP_VERSION);
  // dev builds and plain `npm run build` report 0.0.0-dev.
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION ?? '0.0.0-dev'),
  },
  server: {
    port: 4201,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Mirror production: the VitePress manual is reachable at /docs. In dev it
      // runs as a separate VitePress server (port 4202, base /docs/), proxied here
      // so `npm run dev` serves both the app and the docs from one origin.
      '/docs': {
        target: 'http://localhost:4202',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
