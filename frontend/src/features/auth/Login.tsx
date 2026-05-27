import { Navigate } from 'react-router-dom';
import { useAuthMode } from '../../auth/authMode';
import { OidcLogin } from './OidcLogin';
import { LocalLogin } from './LocalLogin';
import { LegacyClaim } from './LegacyClaim';

export default function Login() {
  const { data } = useAuthMode();
  if (!data) return null;
  if (data.mode !== 'local') return <OidcLogin />;
  if (data.setupRequired) return <Navigate to="/setup" replace />;
  if (data.legacyClaimAvailable) return <LegacyClaim />;
  return <LocalLogin />;
}
