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

export function decode(token: string): LocalUser | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );
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
