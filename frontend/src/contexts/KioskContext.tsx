import { createContext, useContext } from 'react';

export interface KioskState {
  enabled: boolean;
  /** Full read-write available — non-kiosk: always; kiosk: only when an LLM endpoint is configured. */
  interactive: boolean;
}

export const KioskContext = createContext<KioskState>({ enabled: false, interactive: true });

export function useKiosk(): KioskState {
  return useContext(KioskContext);
}
