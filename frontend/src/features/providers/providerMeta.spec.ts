import { describe, it, expect } from 'vitest';
import { ModelProviderKind } from '../../api/models';
import { kindLabel, kindColor, maskKey } from './providerMeta';

describe('kindLabel', () => {
  it('maps known kinds', () => {
    expect(kindLabel(ModelProviderKind.Anthropic)).toBe('Anthropic');
    expect(kindLabel(ModelProviderKind.OpenAi)).toBe('OpenAI');
    expect(kindLabel(ModelProviderKind.OpenAiCompatible)).toBe('OpenAI-compatible');
  });
  it('falls back to Unknown', () => {
    expect(kindLabel(ModelProviderKind.Unknown)).toBe('Unknown');
  });
});

describe('kindColor', () => {
  it('maps each kind to a token', () => {
    expect(kindColor(ModelProviderKind.Anthropic)).toBe('var(--warn)');
    expect(kindColor(ModelProviderKind.OpenAi)).toBe('var(--success)');
    expect(kindColor(ModelProviderKind.OpenAiCompatible)).toBe('var(--teal)');
    expect(kindColor(ModelProviderKind.Unknown)).toBe('var(--text-muted)');
  });
});

describe('maskKey', () => {
  it('fully masks short keys', () => {
    expect(maskKey('short')).toBe('••••••••');
    expect(maskKey('12345678')).toBe('••••••••');
  });
  it('shows a prefix and suffix for long keys', () => {
    expect(maskKey('sk-ant-abcdef0123456789')).toBe('sk-ant-••••••••••••6789');
  });
});
