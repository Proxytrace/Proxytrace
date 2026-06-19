/**
 * Module-level bridge that lets the global `ToastProvider` — mounted above the Router and the
 * current-user context — deep-link an error toast into the Error Log. A component inside the
 * Router (`ErrorLogNavBridge` in `App.tsx`) registers a navigator, but only for users who can
 * actually view the Error Log (local-auth admins); everyone else leaves it `null`, so their
 * error toasts stay non-clickable. Mirrors the handler-registration pattern in `auth/token.ts`.
 */

type ErrorLogNavigator = (errorId: string) => void;

let navigator: ErrorLogNavigator | null = null;

export function setErrorLogNavigator(fn: ErrorLogNavigator | null): void {
  navigator = fn;
}

/** Whether an error toast can deep-link right now (an admin navigator is registered). */
export function canViewErrorLog(): boolean {
  return navigator !== null;
}

export function navigateToErrorLog(errorId: string): void {
  navigator?.(errorId);
}
