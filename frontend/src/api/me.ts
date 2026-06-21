import { api } from './client'
import type { NotificationSeverity, UserRole } from './models'

/** The current authenticated user, as returned by GET /api/auth/me (works in both auth modes). */
export interface Me {
  id: string
  email: string
  role: UserRole
  /** The user's chosen UI language (BCP-47 culture code). */
  language: string
  /** Whether the user opts into email notifications. */
  emailNotificationsEnabled: boolean
  /** Minimum severity that triggers an email (matches backend NotificationSeverity). */
  emailNotificationMinSeverity: NotificationSeverity
  /** Whether the operator has email delivery enabled at all. */
  emailEnabled: boolean
}

export const meApi = {
  get: () => api.get<Me>('/api/auth/me'),
}
