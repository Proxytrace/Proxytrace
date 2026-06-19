import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isLocale, getCachedLocale, cacheLocale, resolveInitialLocale, DEFAULT_LOCALE } from './index'

// The test env is `node` (no DOM), so stub the browser globals the helpers touch.
function inMemoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  }
}

describe('i18n locale helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', inMemoryStorage())
    vi.stubGlobal('navigator', { language: 'en-US' })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('isLocale accepts supported codes and rejects others', () => {
    expect(isLocale('en')).toBe(true)
    expect(isLocale('de')).toBe(true)
    expect(isLocale('xx')).toBe(false)
    expect(isLocale(null)).toBe(false)
    expect(isLocale(undefined)).toBe(false)
  })

  it('cacheLocale + getCachedLocale round-trip a supported locale', () => {
    cacheLocale('de')
    expect(getCachedLocale()).toBe('de')
  })

  it('getCachedLocale ignores an unsupported cached value', () => {
    localStorage.setItem('proxytrace.lang', 'xx')
    expect(getCachedLocale()).toBeNull()
  })

  it('resolveInitialLocale prefers the cached choice over the browser language', () => {
    vi.stubGlobal('navigator', { language: 'en-US' })
    cacheLocale('de')
    expect(resolveInitialLocale()).toBe('de')
  })

  it('resolveInitialLocale falls back to the browser language when no cache', () => {
    vi.stubGlobal('navigator', { language: 'de-DE' })
    expect(resolveInitialLocale()).toBe('de')
  })

  it('resolveInitialLocale falls back to the default for an unsupported browser language', () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' })
    expect(resolveInitialLocale()).toBe(DEFAULT_LOCALE)
  })
})
