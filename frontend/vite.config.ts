import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Production-only CSP. Kept out of dev so it doesn't block Vite's HMR websocket.
// script-src 'self' (only hashed same-origin assets, no inline script); style-src
// allows inline for Tailwind/runtime style attrs; connect-src https for OIDC + API + SSE.
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; font-src 'self' data:; connect-src 'self' https:; " +
  "base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'none'"

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
  plugins: [react(), tailwindcss(), cspMeta()],
  server: {
    port: 4201,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
