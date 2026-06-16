import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import ProxyEndpoint from './components/ProxyEndpoint.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // Renders the OpenAI base_url, live-substituting the operator's configured
    // proxy host when the manual is served from a running instance at /docs.
    app.component('ProxyEndpoint', ProxyEndpoint)
  },
} satisfies Theme
