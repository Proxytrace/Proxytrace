import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { QUERY_KEYS } from './query-keys';

/** Licensing tier. Mirrors the backend `LicenseTier` enum (lowercased on the wire). */
export type LicenseTier = 'free' | 'enterprise';

/** Lifecycle state of the active license. Mirrors backend `LicenseStatus`. */
export type LicenseStatus = 'free' | 'active' | 'grace' | 'expired' | 'invalid';

/** Where the active license came from. Mirrors backend `LicenseSource`. */
export type LicenseSource = 'none' | 'environment' | 'stored' | 'override';

/** Feature flags a license may grant. Mirrors backend `LicenseFeature`. */
export type LicenseFeature =
  | 'OptimizationProposals'
  | 'AgenticEvaluators'
  | 'CustomEvaluators'
  | 'SsoOidc'
  | 'AuditLog'
  | 'Tracey'
  | 'ScheduledTestRuns'
  | 'CustomAnomalyDetectors';

/** Quantitative caps a license may impose. Mirrors backend `LicenseLimit`. */
export type LicenseLimit =
  | 'MaxProjects'
  | 'MaxUsers'
  | 'MaxAgents'
  | 'MaxTestSuites'
  | 'MaxTracesPerMonth'
  | 'TraceRetentionDays';

/** The license snapshot served by `GET /api/license`. */
export interface LicenseDto {
  tier: LicenseTier;
  status: LicenseStatus;
  source: LicenseSource;
  /** Why the configured license was rejected; only set while `status` is `invalid`. */
  invalidReason: string | null;
  expiresAt: string | null;
  gracePeriodEndsAt: string | null;
  customerEmail: string | null;
  features: LicenseFeature[];
  limits: Partial<Record<LicenseLimit, number>>;
  /** True when the current month's trace ingestion quota has been exceeded. */
  quotaExceeded?: boolean;
  /**
   * True for an offline-only license (the JWT carries `offline: true`): an air-gapped key
   * that is never re-validated against the license server, so it cannot be revoked — only
   * `expiresAt` ends it.
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
  /** True when the validated key is an offline-only license (`offline: true`). */
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

/**
 * The current license snapshot. License state changes rarely, so it is cached
 * for an hour and not refetched on window focus.
 */
export function useLicense() {
  return useQuery({
    queryKey: QUERY_KEYS.license,
    queryFn: licenseApi.get,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Whether a given feature is enabled by the current license. Defaults to false
 * while the license is still loading so gated UI stays hidden until confirmed.
 */
export function useFeature(feature: LicenseFeature): boolean {
  const { data } = useLicense();
  return data?.features.includes(feature) ?? false;
}

/** Admin-only: force a re-check against the license server, then refresh the cache. */
export function useRefreshLicense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: licenseApi.refresh,
    onSuccess: (dto) => {
      queryClient.setQueryData(QUERY_KEYS.license, dto);
    },
  });
}

/** Dry-run validation of a license key — nothing is stored or applied. */
export function useValidateLicense() {
  return useMutation({ mutationFn: licenseApi.validate });
}

/**
 * Sets the installation's license key (stores + activates it without a restart).
 * Allowed for admins, and anonymously while setup is incomplete (the wizard's
 * Welcome step runs before the first admin exists).
 */
export function useSetLicense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: licenseApi.set,
    onSuccess: (dto) => {
      queryClient.setQueryData(QUERY_KEYS.license, dto);
    },
  });
}

/** Admin-only: removes the stored key; falls back to the environment license or Free. */
export function useRemoveLicense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: licenseApi.remove,
    onSuccess: (dto) => {
      queryClient.setQueryData(QUERY_KEYS.license, dto);
    },
  });
}
