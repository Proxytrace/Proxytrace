import { BrowserRouter } from 'react-router-dom';
import { useEffect } from 'react';
import { CurrentUserContext } from '../auth/useCurrentUser';
import { KioskContext } from '../contexts/KioskContext';
import { AppRoutes } from './AppRoutes';

export function KioskShell() {
  useEffect(() => {
    document.body.classList.add('kiosk');
    return () => document.body.classList.remove('kiosk');
  }, []);
  return (
    <KioskContext.Provider value={{ enabled: true }}>
      <BrowserRouter>
        <CurrentUserContext.Provider value={{ email: 'demo@proxytrace.dev', signOut: () => {} }}>
          <AppRoutes />
        </CurrentUserContext.Provider>
      </BrowserRouter>
    </KioskContext.Provider>
  );
}
