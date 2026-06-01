import { createContext, useContext } from 'react';

export interface KioskState {
  enabled: boolean;
  /** Whether Tracey is available (non-kiosk: always; kiosk: only when an LLM endpoint is configured). */
  traceyAvailable: boolean;
}

export const KioskContext = createContext<KioskState>({ enabled: false, traceyAvailable: true });

export function useKiosk(): KioskState {
  return useContext(KioskContext);
}
