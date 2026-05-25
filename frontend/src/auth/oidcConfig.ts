import { WebStorageStateStore } from 'oidc-client-ts';
import type { AuthProviderProps } from 'react-oidc-context';

const env = import.meta.env as Record<string, string | undefined>;

export const oidcConfig: AuthProviderProps = {
  authority: env.VITE_OIDC_AUTHORITY ?? '',
  client_id: env.VITE_OIDC_CLIENT_ID ?? 'proxytrace-spa',
  redirect_uri: env.VITE_OIDC_REDIRECT_URI ?? `${window.location.origin}/auth/callback`,
  post_logout_redirect_uri: env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI ?? window.location.origin,
  scope: env.VITE_OIDC_SCOPE ?? 'openid profile email',
  response_type: 'code',
  automaticSilentRenew: true,
  loadUserInfo: true,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};
