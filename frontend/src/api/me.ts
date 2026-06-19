import { api } from './client'
import type { UserRole } from './models'

/** The current authenticated user, as returned by GET /api/auth/me (works in both auth modes). */
export interface Me {
  id: string
  email: string
  role: UserRole
  /** The user's chosen UI language (BCP-47 culture code). */
  language: string
}

export const meApi = {
  get: () => api.get<Me>('/api/auth/me'),
}
