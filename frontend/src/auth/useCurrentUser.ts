import { createContext, useContext } from 'react';

export interface CurrentUser {
  email: string;
  role?: 'Member' | 'Admin';
  signOut: () => void;
}

export const CurrentUserContext = createContext<CurrentUser | null>(null);

export function useCurrentUser(): CurrentUser | null {
  return useContext(CurrentUserContext);
}
