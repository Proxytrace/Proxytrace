import { describe, it, expect } from 'vitest';
import { Priority, ProposalKind } from '../../api/models';
import {
  KIND_HERO_BOX,
  KIND_META,
  KIND_PILL_BG,
  KIND_RATIONALE,
  PRIORITY_META,
  TONE_DOT_BG,
  TONE_SUBTLE_BG,
  TONE_TEXT,
} from './shared';
import type { DisplayTone } from './shared';

const ALL_TONES: DisplayTone[] = ['accent', 'success', 'danger', 'muted', 'secondary', 'teal'];
const ALL_KINDS = Object.values(ProposalKind);
const ALL_PRIORITIES = Object.values(Priority);

describe('tone → class maps', () => {
  it('TONE_TEXT covers every tone with the matching semantic text token', () => {
    expect(TONE_TEXT).toEqual({
      accent: 'text-accent',
      success: 'text-success',
      danger: 'text-danger',
      muted: 'text-muted',
      secondary: 'text-secondary',
      teal: 'text-teal',
    });
  });

  it('TONE_DOT_BG covers every tone with the matching solid background token', () => {
    expect(TONE_DOT_BG).toEqual({
      accent: 'bg-accent',
      success: 'bg-success',
      danger: 'bg-danger',
      muted: 'bg-muted',
      secondary: 'bg-secondary',
      teal: 'bg-teal',
    });
  });

  it('TONE_SUBTLE_BG uses tokens where they exist and exact arbitrary values otherwise', () => {
    // accent/success/danger have subtle tokens; the rest reproduce the prior
    // exact CSS (muted/secondary = rgba(255,255,255,0.04), teal = color-mix 14%).
    expect(TONE_SUBTLE_BG).toEqual({
      accent: 'bg-accent-subtle',
      success: 'bg-success-subtle',
      danger: 'bg-danger-subtle',
      muted: 'bg-[rgba(255,255,255,0.04)]',
      secondary: 'bg-[rgba(255,255,255,0.04)]',
      teal: 'bg-[color-mix(in_srgb,var(--teal)_14%,transparent)]',
    });
  });

  it('all tone maps are exhaustive over DisplayTone', () => {
    for (const tone of ALL_TONES) {
      expect(TONE_TEXT[tone]).toBeTruthy();
      expect(TONE_DOT_BG[tone]).toBeTruthy();
      expect(TONE_SUBTLE_BG[tone]).toBeTruthy();
    }
    expect(Object.keys(TONE_TEXT).sort()).toEqual([...ALL_TONES].sort());
  });
});

describe('kind meta + class recipes', () => {
  it('KIND_META maps each kind to the correct text/background token', () => {
    expect(KIND_META[ProposalKind.SystemPrompt].colorClass).toBe('text-accent');
    expect(KIND_META[ProposalKind.SystemPrompt].bgClass).toBe('bg-accent');
    expect(KIND_META[ProposalKind.Tool].colorClass).toBe('text-success');
    expect(KIND_META[ProposalKind.Tool].bgClass).toBe('bg-success');
    expect(KIND_META[ProposalKind.ModelSwitch].colorClass).toBe('text-teal');
    expect(KIND_META[ProposalKind.ModelSwitch].bgClass).toBe('bg-teal');
  });

  it('KIND_META keeps a CSS-var color string for runtime consumers (hoverGlow)', () => {
    expect(KIND_META[ProposalKind.SystemPrompt].color).toBe('var(--accent-primary)');
    expect(KIND_META[ProposalKind.Tool].color).toBe('var(--success)');
    expect(KIND_META[ProposalKind.ModelSwitch].color).toBe('var(--teal)');
  });

  it('per-kind static recipes are exhaustive and non-empty', () => {
    for (const kind of ALL_KINDS) {
      expect(KIND_META[kind].label).toBeTruthy();
      expect(KIND_PILL_BG[kind]).toBeTruthy();
      expect(KIND_HERO_BOX[kind]).toBeTruthy();
      expect(KIND_RATIONALE[kind]).toBeTruthy();
    }
  });

  it('each kind recipe references that kind’s own token consistently', () => {
    const token: Record<ProposalKind, string> = {
      [ProposalKind.SystemPrompt]: 'var(--accent-primary)',
      [ProposalKind.Tool]: 'var(--success)',
      [ProposalKind.ModelSwitch]: 'var(--teal)',
    };
    for (const kind of ALL_KINDS) {
      expect(KIND_PILL_BG[kind]).toContain(token[kind]);
      expect(KIND_HERO_BOX[kind]).toContain(token[kind]);
      expect(KIND_RATIONALE[kind]).toContain(token[kind]);
    }
  });
});

describe('priority meta', () => {
  it('maps each priority to the correct text/background token', () => {
    expect(PRIORITY_META[Priority.Critical].colorClass).toBe('text-danger');
    expect(PRIORITY_META[Priority.Critical].bgClass).toBe('bg-danger');
    expect(PRIORITY_META[Priority.High].colorClass).toBe('text-warn');
    expect(PRIORITY_META[Priority.High].bgClass).toBe('bg-warn');
    expect(PRIORITY_META[Priority.Medium].colorClass).toBe('text-secondary');
    expect(PRIORITY_META[Priority.Medium].bgClass).toBe('bg-secondary');
    expect(PRIORITY_META[Priority.Low].colorClass).toBe('text-muted');
    expect(PRIORITY_META[Priority.Low].bgClass).toBe('bg-muted');
  });

  it('is exhaustive over Priority', () => {
    for (const p of ALL_PRIORITIES) {
      expect(PRIORITY_META[p].label).toBeTruthy();
      expect(PRIORITY_META[p].colorClass).toBeTruthy();
      expect(PRIORITY_META[p].bgClass).toBeTruthy();
    }
  });
});
