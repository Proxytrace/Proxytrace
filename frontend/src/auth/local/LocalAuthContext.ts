import { createContext } from "react";

export interface LocalUser {
  id: string;
  email: string;
  role: "Viewer" | "Member" | "Admin";
}

export interface LocalAuthContextValue {
  isAuthenticated: boolean;
  user: LocalUser | null;
  setToken: (token: string | null) => void;
  signinRedirect: () => void;
  signoutRedirect: () => void;
}

// NOTE: this is a *display-only* decode. The signature is NOT verified here — the
// backend must authorize every request and never trust a client-decoded role.
export function decode(token: string): LocalUser | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );
    // Treat an expired token as unauthenticated so the UI doesn't show a stale
    // session until the next 401.
    if (typeof json.exp === "number" && json.exp * 1000 <= Date.now()) return null;
    if (!json.sub || !json.email) return null;
    return {
      id: json.sub,
      email: json.email,
      role:
        json["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ??
        json.role ??
        "Viewer",
    };
  } catch {
    return null;
  }
}

const LocalAuthContext = createContext<LocalAuthContextValue | null>(null);

export default LocalAuthContext;
