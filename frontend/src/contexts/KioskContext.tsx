import { createContext, useContext } from 'react';

export interface KioskState {
  enabled: boolean;
}

export const KioskContext = createContext<KioskState>({ enabled: false });

export function useKiosk(): KioskState {
  return useContext(KioskContext);
}
