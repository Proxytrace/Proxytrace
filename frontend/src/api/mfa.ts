import { api } from './client'

/** TOTP enrollment material returned when starting MFA setup. */
export interface MfaSetupResponse {
  /** Base32 shared secret (shown as a manual-entry fallback to the QR code). */
  secret: string
  /** otpauth:// URI the authenticator app consumes (rendered as a QR code client-side). */
  otpAuthUri: string
}

export interface MfaActivateResponse {
  /** One-time backup codes, shown exactly once at activation. */
  backupCodes: string[]
}

/** Authenticated TOTP enrollment endpoints (the pre-session login/verify endpoints live in localAuthApi). */
export const mfaApi = {
  /** Starts (or restarts) enrollment; returns a fresh secret + otpauth URI. 409 if already enabled. */
  setup: () => api.post<MfaSetupResponse>('/api/auth/mfa/setup', {}),
  /** Confirms enrollment with a first code; returns the backup codes. */
  activate: (code: string) => api.post<MfaActivateResponse>('/api/auth/mfa/activate', { code }),
  /** Disables MFA after re-authenticating with the account password. */
  disable: (password: string) => api.post<void>('/api/auth/mfa/disable', { password }),
}
