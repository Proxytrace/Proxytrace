import { api } from './client';

/**
 * Support tier. Mirrors the backend `LicenseTier` enum (lowercased on the wire). The tier has no
 * functional effect — every feature is always available — it only records whether an Enterprise
 * support contract is on file.
 */
export type LicenseTier = 'free' | 'enterprise';

/** Lifecycle state of the active support key. Mirrors backend `LicenseStatus`. */
export type LicenseStatus = 'free' | 'active' | 'grace' | 'expired' | 'invalid';

/** Where the active support key came from. Mirrors backend `LicenseSource`. */
export type LicenseSource = 'none' | 'environment' | 'stored';

/** The support-key snapshot served by `GET /api/license`. */
export interface LicenseDto {
  tier: LicenseTier;
  status: LicenseStatus;
  source: LicenseSource;
  /** Why the configured key was rejected; only set while `status` is `invalid`. */
  invalidReason: string | null;
  expiresAt: string | null;
  gracePeriodEndsAt: string | null;
  customerEmail: string | null;
  /**
   * True for an offline-only key (the JWT carries `offline: true`): an air-gapped key that is
   * never re-validated against the license server, so it cannot be revoked — only `expiresAt`
   * ends it.
   */
  offline: boolean;
}

/** Outcome of a dry-run key validation (`POST /api/license/validate`). */
export interface ValidateLicenseResultDto {
  valid: boolean;
  reason: string | null;
  tier: LicenseTier | null;
  expiresAt: string | null;
  customerEmail: string | null;
  /** True when the validated key is an offline-only key (`offline: true`). */
  offline: boolean;
}

export const licenseApi = {
  get: () => api.get<LicenseDto>('/api/license'),
  refresh: () => api.post<LicenseDto>('/api/license/refresh'),
  validate: (license: string) =>
    api.post<ValidateLicenseResultDto>('/api/license/validate', { license }),
  set: (license: string) => api.put<LicenseDto>('/api/license', { license }),
  remove: () => api.del<LicenseDto>('/api/license'),
};
