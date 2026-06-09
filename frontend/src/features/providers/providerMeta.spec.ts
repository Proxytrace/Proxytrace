import { describe, it, expect } from 'vitest';
import { ModelProviderKind } from '../../api/models';
import { kindLabel, kindColor, maskKey, isDefaultEndpoint, isAzureEndpoint } from './providerMeta';

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

describe('isDefaultEndpoint', () => {
  it('treats canonical Anthropic/OpenAI endpoints as default', () => {
    expect(isDefaultEndpoint(ModelProviderKind.Anthropic, 'https://api.anthropic.com/v1')).toBe(true);
    expect(isDefaultEndpoint(ModelProviderKind.OpenAi, 'https://api.openai.com/v1')).toBe(true);
  });
  it('treats custom endpoints as non-default', () => {
    expect(isDefaultEndpoint(ModelProviderKind.OpenAi, 'https://proxy.internal/v1')).toBe(false);
    expect(isDefaultEndpoint(ModelProviderKind.OpenAiCompatible, 'https://x.openai.azure.com/')).toBe(false);
  });
});

describe('isAzureEndpoint', () => {
  it('detects azure hosts', () => {
    expect(isAzureEndpoint('https://r.openai.azure.com/')).toBe(true);
    expect(isAzureEndpoint('https://api.openai.com/v1')).toBe(false);
  });
});
