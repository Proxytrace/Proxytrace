import { beforeAll, describe, expect, it } from 'vitest';
import { i18n } from '../i18n';
import {
  normalizeProviderConnectionError,
  providerConnectionErrorMessage,
} from './providerConnection';

beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));

describe('providerConnectionErrorMessage', () => {
  it.each([
    ['Unauthorized', 'That key was rejected by the provider.'],
    ['NetworkError', 'Could not reach the provider.'],
    ['UnsupportedKind', 'This provider kind does not support connection testing.'],
    ['Unknown', 'Could not verify the provider connection.'],
  ])('maps %s to localized copy', (errorCode, expected) => {
    expect(providerConnectionErrorMessage(i18n, { errorCode })).toBe(expected);
  });

  it('includes the support id for an unknown error', () => {
    expect(providerConnectionErrorMessage(i18n, {
      errorCode: 'Unknown',
      errorId: 'error-123',
    })).toBe('Could not verify the provider connection. Error ID: error-123');
  });

  it('falls back to Unknown for an unrecognized code', () => {
    expect(normalizeProviderConnectionError('Unexpected')).toBe('Unknown');
  });
});
