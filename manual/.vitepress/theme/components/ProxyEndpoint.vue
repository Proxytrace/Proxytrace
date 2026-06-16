<script setup lang="ts">
/**
 * Shows the OpenAI `base_url` a client should target. When the manual is served
 * from inside a running Proxytrace instance (at `/docs`), it fetches
 * `/api/config` and substitutes the operator's *actually configured* proxy host
 * (`Proxy:PublicBaseUrl`) for the placeholder, so readers copy a URL that works
 * against this instance. On the public docs site (different origin, no API) the
 * fetch fails and the placeholder host is shown instead.
 */
import { onMounted, ref, computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Project slug to put in the path. Defaults to a visible placeholder. */
    project?: string
    /** Placeholder host shown until/unless a live value is resolved. */
    placeholder?: string
  }>(),
  { project: '<project-slug>', placeholder: 'https://your-proxytrace-host' },
)

const liveHost = ref<string | null>(null)
const checked = ref(false)

onMounted(async () => {
  try {
    // Same-origin when bundled under /docs; absolute path hits the app root.
    const res = await fetch('/api/config', { headers: { Accept: 'application/json' } })
    if (res.ok) {
      const data = await res.json()
      const url = typeof data?.proxyBaseUrl === 'string' ? data.proxyBaseUrl.trim() : ''
      if (url) liveHost.value = url.replace(/\/+$/, '')
    }
  } catch {
    // Not served from a live instance (e.g. public docs) — keep the placeholder.
  } finally {
    checked.value = true
  }
})

const host = computed(() => liveHost.value ?? props.placeholder)
const isLive = computed(() => liveHost.value !== null)
</script>

<template>
  <div class="proxy-endpoint">
    <div class="proxy-endpoint__label">
      Your OpenAI <code>base_url</code>
      <span v-if="isLive" class="proxy-endpoint__badge" title="Read from this instance's /api/config">
        live · this instance
      </span>
    </div>
    <code class="proxy-endpoint__url">
      <span class="proxy-endpoint__host" :class="{ 'is-live': isLive }">{{ host }}</span><!--
      -->/<span class="proxy-endpoint__project">{{ project }}</span>/openai/v1
    </code>
    <p v-if="!isLive" class="proxy-endpoint__hint">
      Replace <code>{{ placeholder }}</code> with your operator's proxy host. The running app
      shows the real value in the setup wizard, on <strong>Providers → API keys</strong>, and
      behind the “How to wire the proxy?” link on the Traces page.
    </p>
  </div>
</template>

<style scoped>
.proxy-endpoint {
  margin: 16px 0;
  padding: 16px;
  border: 1px solid var(--vp-c-border);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
}
.proxy-endpoint__label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--vp-c-text-2);
  margin-bottom: 8px;
}
.proxy-endpoint__badge {
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 999px;
  color: var(--vp-c-success-1);
  background: color-mix(in srgb, var(--vp-c-success-1) 14%, transparent);
}
.proxy-endpoint__url {
  display: block;
  font-size: 15px;
  word-break: break-all;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--vp-code-bg);
}
.proxy-endpoint__host.is-live {
  color: var(--vp-c-success-1);
  font-weight: 600;
}
.proxy-endpoint__project {
  color: var(--vp-c-text-2);
  font-style: italic;
}
.proxy-endpoint__hint {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--vp-c-text-3);
}
</style>
