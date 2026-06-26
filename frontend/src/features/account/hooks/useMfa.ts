import { useMutation, useQueryClient } from '@tanstack/react-query'
import { mfaApi } from '../../../api/mfa'
import { QUERY_KEYS } from '../../../api/query-keys'

/** Starts TOTP enrollment (fresh secret + otpauth URI). */
export function useMfaSetup() {
  return useMutation({
    mutationFn: () => mfaApi.setup(),
  })
}

/** Confirms enrollment with a first code; returns backup codes and refreshes `me`. */
export function useMfaActivate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => mfaApi.activate(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.me }),
  })
}

/** Disables MFA after password re-auth; refreshes `me`. */
export function useMfaDisable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (password: string) => mfaApi.disable(password),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.me }),
  })
}
