import { msg } from '@lingui/core/macro';
import type { I18n, MessageDescriptor } from '@lingui/core';
import type { ProviderConnectionErrorCode } from '../api/setup';

const CONNECTION_ERROR_MESSAGES: Record<ProviderConnectionErrorCode, MessageDescriptor> = {
  Unauthorized: msg`That key was rejected by the provider.`,
  NetworkError: msg`Could not reach the provider.`,
  UnsupportedKind: msg`This provider kind does not support connection testing.`,
  Unknown: msg`Could not verify the provider connection.`,
};

export function normalizeProviderConnectionError(
  errorCode: string | null | undefined,
): ProviderConnectionErrorCode {
  switch (errorCode) {
    case 'Unauthorized':
    case 'NetworkError':
    case 'UnsupportedKind':
    case 'Unknown':
      return errorCode;
    default:
      return 'Unknown';
  }
}

export function providerConnectionErrorMessage(
  i18n: I18n,
  details: { errorCode?: string | null; error?: string | null; errorId?: string | null },
): string {
  if (details.error) return details.error;

  const errorCode = normalizeProviderConnectionError(details.errorCode);
  if (errorCode === 'Unknown' && details.errorId) {
    return i18n._(msg`Could not verify the provider connection. Error ID: ${details.errorId}`);
  }

  return i18n._(CONNECTION_ERROR_MESSAGES[errorCode]);
}

export class ProviderConnectionTestError extends Error {
  constructor(
    public readonly errorCode: ProviderConnectionErrorCode,
    public readonly serverError: string | null,
    public readonly errorId: string | null,
  ) {
    super('Provider connection verification failed');
    this.name = 'ProviderConnectionTestError';
  }
}
