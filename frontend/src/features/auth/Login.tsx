import { Navigate } from 'react-router-dom';
import { useAuthMode } from '../../auth/authMode';
import LegacyClaim from './LegacyClaim';
import LocalLogin from './LocalLogin';
import OidcLogin from './OidcLogin';

export default function Login() {
  const { data } = useAuthMode();
  if (!data) return null;
  if (data.mode !== 'local') return <OidcLogin />;
  if (data.setupRequired) return <Navigate to="/setup" replace />;
  if (data.legacyClaimAvailable) return <LegacyClaim />;
  return <LocalLogin />;
}
