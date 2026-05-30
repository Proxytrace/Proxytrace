import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { QUERY_KEYS } from './query-keys';

/** Licensing tier. Mirrors the backend `LicenseTier` enum (lowercased on the wire). */
export type LicenseTier = 'free' | 'enterprise';

/** Lifecycle state of the active license. Mirrors backend `LicenseStatus`. */
export type LicenseStatus = 'free' | 'active' | 'grace' | 'expired';

/** Feature flags a license may grant. Mirrors backend `LicenseFeature`. */
export type LicenseFeature =
  | 'OptimizationProposals'
  | 'AgenticEvaluators'
  | 'CustomEvaluators'
  | 'SsoOidc'
  | 'AuditLog';

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
  expiresAt: string | null;
  gracePeriodEndsAt: string | null;
  customerEmail: string | null;
  features: LicenseFeature[];
  limits: Partial<Record<LicenseLimit, number>>;
  /** True when the current month's trace ingestion quota has been exceeded. */
  quotaExceeded?: boolean;
}

export const licenseApi = {
  get: () => api.get<LicenseDto>('/api/license'),
  refresh: () => api.post<LicenseDto>('/api/license/refresh'),
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
