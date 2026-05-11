import { createContext, useContext } from 'react';

export interface CurrentUser {
  email: string;
  role?: 'Viewer' | 'Member' | 'Admin';
  signOut: () => void;
}

export const CurrentUserContext = createContext<CurrentUser | null>(null);

export function useCurrentUser(): CurrentUser | null {
  return useContext(CurrentUserContext);
}
