import { describe, it, expect } from 'vitest'
import { fmtLatency, fmtTokens, fmtDuration, fmtPct, fmtCost } from './format'

describe('fmtLatency', () => {
  it('formats sub-second as ms', () => expect(fmtLatency(250)).toBe('250ms'))
  it('formats over 1s', () => expect(fmtLatency(1500)).toBe('1.5s'))
})

describe('fmtTokens', () => {
  it('passes through small numbers', () => expect(fmtTokens(500)).toBe('500'))
  it('formats thousands with k', () => expect(fmtTokens(1500)).toBe('1.5k'))
  it('formats millions with M', () => expect(fmtTokens(1_500_000)).toBe('1.5M'))
})

describe('fmtDuration', () => {
  it('returns em dash for null', () => expect(fmtDuration(null)).toBe('—'))
  it('formats ms', () => expect(fmtDuration(500)).toBe('500ms'))
  it('formats seconds', () => expect(fmtDuration(1500)).toBe('1.5s'))
  it('formats minutes', () => expect(fmtDuration(90_000)).toBe('1m 30s'))
})

describe('fmtPct', () => {
  it('converts fraction to percent', () => expect(fmtPct(0.75)).toBe('75%'))
})

describe('fmtCost', () => {
  it('returns em dash for null', () => expect(fmtCost(null)).toBe('—'))
  it('formats tiny cost as less-than', () => expect(fmtCost(0.0005)).toBe('<$0.001'))
  it('formats normal cost', () => expect(fmtCost(0.0123)).toBe('$0.0123'))
})
